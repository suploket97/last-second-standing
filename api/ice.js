// Vercel serverless function: GET /api/ice
// Returns the relay (TURN) servers the game uses when a network blocks direct connections,
// for example university Wi-Fi like eduroam. Your relay passwords stay in Vercel's
// environment variables and are never written into the web page.
//
// Set ONE of these in Vercel → Project → Settings → Environment Variables:
//   Cloudflare (recommended):  CF_TURN_KEY_ID  and  CF_TURN_API_TOKEN
//   ExpressTURN:               EXPRESSTURN_USERNAME  and  EXPRESSTURN_PASSWORD
//                              (optional EXPRESSTURN_HOST, default relay1.expressturn.com)
//   Metered:                   METERED_CREDENTIALS_URL
// Then redeploy.

const STUN = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
const TTL_SECONDS = 6 * 60 * 60; // credentials last 6 hours, longer than any game night session

function sameSite(req) {
  // Light protection so other websites can't use your relay allowance.
  const site = req.headers["sec-fetch-site"];
  if (site) return site === "same-origin";
  const ref = req.headers.referer || req.headers.origin || "";
  try { return new URL(ref).host === req.headers.host; } catch (e) { return false; }
}

// Browsers can't use port 53, so drop any URL on it to avoid slow timeouts.
function dropPort53(servers) {
  return servers
    .map(s => {
      const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter(u => !/:53(\?|$)/.test(u));
      return urls.length ? { ...s, urls } : null;
    })
    .filter(Boolean);
}

async function fromCloudflare() {
  const id = process.env.CF_TURN_KEY_ID, token = process.env.CF_TURN_API_TOKEN;
  if (!id || !token) return null;
  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(id)}/credentials/generate-ice-servers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl: TTL_SECONDS })
  });
  if (!r.ok) throw new Error(`Cloudflare TURN returned ${r.status}`);
  const data = await r.json();
  const list = Array.isArray(data.iceServers) ? data.iceServers : data.iceServers ? [data.iceServers] : [];
  return { provider: "cloudflare", iceServers: dropPort53(list) };
}

function fromExpressTurn() {
  const user = process.env.EXPRESSTURN_USERNAME, pass = process.env.EXPRESSTURN_PASSWORD;
  if (!user || !pass) return null;
  const host = process.env.EXPRESSTURN_HOST || "relay1.expressturn.com";
  return {
    provider: "expressturn",
    iceServers: [{
      urls: [`turn:${host}:3478?transport=udp`, `turn:${host}:3478?transport=tcp`, `turns:${host}:443?transport=tcp`],
      username: user,
      credential: pass
    }]
  };
}

async function fromMetered() {
  const url = process.env.METERED_CREDENTIALS_URL;
  if (!url) return null;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Metered returned ${r.status}`);
  const list = await r.json();
  return { provider: "metered", iceServers: dropPort53(Array.isArray(list) ? list : []) };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!sameSite(req)) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "forbidden" }));
  }
  let result = null, problem = null;
  for (const source of [fromCloudflare, fromExpressTurn, fromMetered]) {
    try { result = await source(); if (result && result.iceServers.length) break; result = null; }
    catch (e) { problem = String(e.message || e); }
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(result
    ? { relay: true, provider: result.provider, iceServers: STUN.concat(result.iceServers) }
    : { relay: false, reason: problem || "no relay configured", iceServers: STUN }));
};
