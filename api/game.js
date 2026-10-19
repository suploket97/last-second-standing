// Last Second Standing — game server (Vercel serverless function, Node runtime)
//
// The server is the only thing that changes the game. Every button press is timed with the
// server's own clock, so network lag on a phone never changes how long someone held the clock.
// Game rooms live in Upstash Redis for 12 hours. All traffic is ordinary HTTPS, so it works on
// any network (eduroam, mobile data, guest Wi-Fi).
//
// Environment variables (Vercel → Project → Settings → Environment Variables), either pair:
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   (copied from the Upstash console)
//   KV_REST_API_URL        + KV_REST_API_TOKEN          (added automatically by Vercel's Upstash integration)
//
//   GET  /api/game?code=K7Q2[&pid=…&touch=1][&seen=1]  → current state (phones and the big screen poll this)
//   POST /api/game  {op, code, …}                      → create, join, press, and the host's controls

const crypto = require("crypto");

const TTL = 12 * 60 * 60;                     // rooms expire after 12 hours
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_PLAYERS = 40;

/* ---------------- Upstash Redis over its REST API (no packages needed) ---------------- */
function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}
async function redis(cmd) {
  const c = redisConfig();
  const r = await fetch(c.url, { method: "POST", headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("storage: " + (j.error || r.status));
  return j.result;
}
const kState = c => `lss:${c}`;
const kSeen = c => `lss:${c}:seen`;

// Stored as "<version>|<json>". The Lua script saves only if nobody changed the room meanwhile.
const CAS = "local cur=redis.call('GET',KEYS[1]) if not cur then return -1 end " +
  "local p=string.find(cur,'|',1,true) if string.sub(cur,1,p-1)==ARGV[1] then " +
  "redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]) return 1 end return 0";

async function load(code) {
  const raw = await redis(["GET", kState(code)]);
  if (!raw) return null;
  const p = raw.indexOf("|");
  return JSON.parse(raw.slice(p + 1));
}
async function saveCAS(st, prevV) {
  st.v = prevV + 1;
  const r = await redis(["EVAL", CAS, "1", kState(st.code), String(prevV), `${st.v}|${JSON.stringify(st)}`, String(TTL)]);
  return Number(r) === 1;
}

/* ---------------- game rules (pure functions on the state) ---------------- */
const aliveCount = st => st.players.filter(p => !p.out).length;
function nextAlive(st, i) {
  const n = st.players.length;
  for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (!st.players[j].out) return j; }
  return i;
}
function startRound(st, starter) {
  st.round++; st.remaining = st.settings.total * 1000; st.idx = starter; st.run = null;
  st.log = []; st.loser = -1; st.phase = "ready"; st.tag = ""; st.msg = "";
}
function timeUp(st) {
  const L = st.players[st.idx];
  L.l++; st.loser = st.idx; st.remaining = 0; st.run = null;
  st.log.push({ n: L.n, lose: true });
  if (st.settings.rule === "eliminate") {
    L.out = true;
    if (aliveCount(st) <= 1) {
      const w = st.players.findIndex(p => !p.out);
      st.winner = w; st.phase = "gameover"; st.tag = (st.players[w] ? st.players[w].n : "Nobody") + " wins";
      st.msg = `${L.n} was holding the clock at zero and is out. ${st.players[w] ? st.players[w].n : ""} is the last one standing.`;
    } else {
      st.nextStarter = nextAlive(st, st.idx); st.phase = "roundover"; st.tag = "Time up";
      st.msg = `${L.n} was holding the clock at zero and is eliminated. ${aliveCount(st)} players remain. ${st.players[st.nextStarter].n} starts the next round.`;
    }
  } else {
    st.nextStarter = st.idx; st.phase = "roundover"; st.tag = "Time up";
    st.msg = `${L.n} was holding the clock at zero, so ${L.n} starts the next round.`;
  }
}
// If the clock has run out since the last request, record the time-up now.
function settle(st, now) {
  if (st.phase === "running" && st.run && now >= st.run.since + st.run.remStart) { timeUp(st); return true; }
  return false;
}
function press(st, now) {
  if (st.phase === "ready") { st.phase = "running"; st.run = { since: now, remStart: st.remaining }; return null; }
  if (st.phase !== "running") return { status: 409, error: "not_running" };
  const held = now - st.run.since;
  if (held < st.settings.minHold * 1000) return { status: 409, error: "locked" };
  const rem = st.run.remStart - held;
  if (rem <= 0) { timeUp(st); return null; }
  st.remaining = rem; st.run = null;
  st.log.push({ n: st.players[st.idx].n, ms: held });
  st.phase = "ready"; st.idx = nextAlive(st, st.idx);
  return null;
}
const cleanName = s => String(s || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 20);
function uniqueName(st, base, exceptId) {
  let n = base, k = 2;
  while (st.players.some(p => p.id !== exceptId && p.n.toLowerCase() === n.toLowerCase())) n = base + " " + (k++);
  return n;
}
function publicState(st) {
  const { hostKey, kicked, ...pub } = st;
  return pub;
}

/* ---------------- request handling ---------------- */
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 20000) break; chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}
const normCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
const isHost = (st, body) => typeof body.hostKey === "string" && body.hostKey.length > 10 && body.hostKey === st.hostKey;

// Load, settle, apply a change, save with compare-and-set; retry if two requests collide.
async function mutate(code, now, fn) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const st = await load(code);
    if (!st) return { status: 404, body: { error: "no_room" } };
    const prevV = st.v;
    const settled = settle(st, now);
    const out = fn(st) || null;
    if (out && out.error && !settled) return { status: out.status || 400, body: { error: out.error, state: publicState(st), now } };
    if (await saveCAS(st, prevV)) {
      if (out && out.error) return { status: out.status || 400, body: { error: out.error, state: publicState(st), now } };
      return { status: 200, body: { state: publicState(st), now, ...(out && out.extra) } };
    }
  }
  return { status: 409, body: { error: "busy" } };
}

module.exports = async function handler(req, res) {
  try {
    if (!redisConfig()) return send(res, 500, { error: "not_configured" });
    const url = new URL(req.url, "http://x");
    const now = Date.now();

    if (req.method === "GET") {
      const code = normCode(url.searchParams.get("code"));
      if (code.length !== 4) return send(res, 400, { error: "bad_code" });
      let st = await load(code);
      if (!st) return send(res, 404, { error: "no_room", now });
      if (settle(st, now)) {
        // record the time-up; if another request saved first, show what it saved
        if (!(await saveCAS(st, st.v))) st = (await load(code)) || st;
      }
      const pid = String(url.searchParams.get("pid") || "").slice(0, 40);
      const out = { state: publicState(st), now };
      if (pid && url.searchParams.get("touch")) await redis(["HSET", kSeen(code), pid, String(now)]);
      if (url.searchParams.get("seen")) {
        const flat = (await redis(["HGETALL", kSeen(code)])) || [];
        const seen = {}; for (let i = 0; i < flat.length; i += 2) seen[flat[i]] = Number(flat[i + 1]);
        out.seen = seen;
      }
      return send(res, 200, out);
    }

    if (req.method !== "POST") return send(res, 405, { error: "method" });
    const body = await readBody(req);
    const op = String(body.op || "");

    if (op === "create") {
      for (let t = 0; t < 10; t++) {
        const code = Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join("");
        const hostKey = crypto.randomBytes(18).toString("base64url");
        const st = {
          v: 1, code, hostKey, created: now, phase: "lobby", round: 0,
          settings: { total: 60, rule: "starter", minHold: 1, blind: false },
          players: [], kicked: [], idx: 0, run: null, remaining: 60000, log: [],
          loser: -1, winner: -1, nextStarter: 0, tag: "", msg: ""
        };
        const ok = await redis(["SET", kState(code), `1|${JSON.stringify(st)}`, "NX", "EX", String(TTL)]);
        if (ok) { await redis(["EXPIRE", kSeen(code), String(TTL)]).catch(() => {}); return send(res, 200, { code, hostKey, state: publicState(st), now }); }
      }
      return send(res, 503, { error: "no_code" });
    }

    const code = normCode(body.code);
    if (code.length !== 4) return send(res, 400, { error: "bad_code" });
    const pid = String(body.pid || "").slice(0, 40);

    let result;
    switch (op) {
      case "join": {
        const name = cleanName(body.name);
        if (!pid || !name) return send(res, 400, { error: "bad_join" });
        result = await mutate(code, now, st => {
          if ((st.kicked || []).includes(pid)) return { status: 403, error: "kicked" };
          const me = st.players.find(p => p.id === pid);
          if (me) { if (st.phase === "lobby") me.n = uniqueName(st, name, pid); return null; }
          if (st.phase !== "lobby") return null;           // watches until the host goes back to setup
          if (st.players.length >= MAX_PLAYERS) return { status: 409, error: "full" };
          st.players.push({ id: pid, n: uniqueName(st, name, pid), out: false, l: 0, phone: true });
          return null;
        });
        if (result.status === 200) await redis(["HSET", kSeen(code), pid, String(now)]).catch(() => {});
        break;
      }
      case "leave":
        result = await mutate(code, now, st => {
          if (st.phase === "lobby") st.players = st.players.filter(p => p.id !== pid);
          return null;
        });
        break;
      case "press":
        result = await mutate(code, now, st => {
          if (st.phase !== "ready" && st.phase !== "running") return { status: 409, error: "not_playing" };
          const cur = st.players[st.idx];
          if (!isHost(st, body) && (!cur || cur.id !== pid)) return { status: 403, error: "not_your_turn" };
          // "expect" is the phase the button showed (Start = ready, Stop = running); a double tap never counts twice
          if (body.expect && body.expect !== st.phase) return { status: 409, error: "stale" };
          return press(st, now);
        });
        break;
      default: {
        // host controls
        result = await mutate(code, now, st => {
          if (!isHost(st, body)) return { status: 403, error: "not_host" };
          switch (op) {
            case "settings": {
              const s = body.settings || {};
              if (st.phase !== "lobby") return { status: 409, error: "in_game" };
              const total = Math.round(Number(s.total));
              if (total >= 5 && total <= 600) st.settings.total = total;
              if (s.rule === "starter" || s.rule === "eliminate") st.settings.rule = s.rule;
              if ([0, 1, 2, 3].includes(Number(s.minHold))) st.settings.minHold = Number(s.minHold);
              if (typeof s.blind === "boolean") st.settings.blind = s.blind;
              return null;
            }
            case "add": {
              const name = cleanName(body.name);
              if (!name) return { status: 400, error: "bad_name" };
              if (st.players.some(p => p.n.toLowerCase() === name.toLowerCase())) return { status: 409, error: "name_taken" };
              if (st.players.length >= MAX_PLAYERS) return { status: 409, error: "full" };
              st.players.push({ id: "local-" + crypto.randomBytes(5).toString("hex"), n: name, out: false, l: 0, phone: false });
              return null;
            }
            case "remove": {
              const p = st.players.find(x => x.id === body.id);
              if (!p) return null;
              if (st.phase !== "lobby") return { status: 409, error: "in_game" };
              st.players = st.players.filter(x => x.id !== body.id);
              if (p.phone) st.kicked = (st.kicked || []).concat(p.id).slice(-200);
              return null;
            }
            case "up": {
              const i = st.players.findIndex(x => x.id === body.id);
              if (i > 0 && st.phase === "lobby") [st.players[i - 1], st.players[i]] = [st.players[i], st.players[i - 1]];
              return null;
            }
            case "start":
              if (st.phase !== "lobby") return { status: 409, error: "in_game" };
              if (st.players.length < 2) return { status: 409, error: "need_two" };
              st.players.forEach(p => { p.out = false; p.l = 0; });
              st.round = 0; st.winner = -1;
              startRound(st, 0);
              return null;
            case "next":
              if (st.phase === "gameover") { st.players.forEach(p => { p.out = false; p.l = 0; }); st.round = 0; st.winner = -1; startRound(st, 0); return null; }
              if (st.phase !== "roundover") return { status: 409, error: "not_over" };
              startRound(st, st.nextStarter);
              return null;
            case "setup":
              st.phase = "lobby"; st.run = null; st.log = []; st.tag = ""; st.msg = "";
              st.players.forEach(p => { p.out = false; });
              return null;
            case "close":
              st.phase = "closed"; st.run = null;
              return null;
            default:
              return { status: 400, error: "unknown_op" };
          }
        });
      }
    }
    return send(res, result.status, result.body);
  } catch (e) {
    return send(res, 500, { error: "server", detail: String(e && e.message || e).slice(0, 200) });
  }
};
