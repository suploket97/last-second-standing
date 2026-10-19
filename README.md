# Last Second Standing (peer-to-peer edition)

A pass-the-clock party game. The host puts the game on a big screen, players join on their phones with a 4-character game PIN (or by scanning the QR code), and each player starts and stops a shared countdown. Whoever is holding the clock when it hits zero loses.

No accounts, no database, no game server. The whole game is one file: `index.html`.

## How it works

- The **host's browser is the game server.** It keeps the official clock, the player list and the scores.
- **Phones connect straight to the host's browser** (WebRTC, the same technology video calls use) and send only their button presses.
- The free PeerJS service introduces a phone to the host when it joins. No game data is stored anywhere.
- **On locked-down networks** (eduroam and other university Wi-Fi, schools, offices, guest Wi-Fi) devices are not allowed to reach each other directly. There, the game sends its messages through a **relay server** on port 443, the same port as ordinary secure websites, so those networks let it through. This is how video-call apps work too. Wherever a direct link is possible, the game still uses it.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game |
| `api/ice.js` | A tiny Vercel function that hands out your relay server details, so your relay passwords never appear in the web page |
| `vercel.json` | Tells Vercel not to cache old versions, so updates show up straight away |
| `README.md` | This guide |

## Deploy on Vercel

The game is a plain static site, so Vercel needs no build step.

**Option A: from GitHub (recommended)**

1. Create a GitHub repository and upload `index.html`, `vercel.json` and the `api` folder to the top level of it (not inside another folder).
2. In Vercel, click **Add New → Project** and import that repository.
3. Leave **Framework Preset** as **Other**. Leave the build command, output directory and install command empty.
4. Click **Deploy**. Your game is live at `https://your-project.vercel.app`.

Every time you push a change to GitHub, Vercel redeploys automatically.

**Option B: from your computer with the Vercel CLI**

You need Node.js installed. In a terminal, inside this folder, run:

```
npx vercel          # first time: answer the setup questions, accept the defaults
npx vercel --prod   # publish to your live address
```

If Vercel asks for a framework, choose **Other**.

**If you already deployed the earlier version**, replace `index.html` with this one, add `vercel.json` and the `api` folder, then push or run `npx vercel --prod` again.

## How to play

1. On the laptop or TV, open your Vercel address and click **Create a room**. A game PIN and QR code appear.
2. Players open the same address on their phones (or scan the QR code), type the PIN and a nickname, and tap **Enter**. They appear in the host's list as they join.
3. The host sets the time, the loser rule and the minimum hold, then clicks **Start game**. The host screen becomes the big countdown display.
4. The player whose turn it is gets a green **Start** button. They press it to start the clock and press **Stop** to pass it on. Everyone else sees a grey **Wait** button, and the next player gets a "You're next" warning.
5. When the clock reaches zero, whoever is holding it loses:
   - **Loser starts next round**: everyone stays in and losses are counted.
   - **Loser is eliminated**: the game continues until one player is left.

Players without a phone can still play. Add their names on the setup screen and the host presses **Start/Stop for [name]** (or the space bar) for them.

## Switch on the relay server (needed for eduroam and similar networks)

Without a relay, phones on eduroam and other university, school, office or guest Wi-Fi will see "this network blocks direct connections". The setup screen tells you whether the relay is on.

Choose **one** provider. Both have free allowances that a party game will never get near.

**Option A: Cloudflare (recommended, first 1,000 GB per month free)**

1. Sign in at https://dash.cloudflare.com (a free account is fine).
2. Open **Realtime** in the left menu, then **TURN Server**, and create a new TURN key. Give it any name.
3. Copy the two values Cloudflare shows: the **Turn Token ID** and the **API Token**. The API token is only shown once.
4. In Vercel, open your project → **Settings → Environment Variables** and add:
   - `CF_TURN_KEY_ID` = the Turn Token ID
   - `CF_TURN_API_TOKEN` = the API Token
5. Redeploy (Vercel → **Deployments** → the latest one → **Redeploy**). Environment variables only take effect after a redeploy.

Cloudflare may ask you to add a payment method to use Realtime. You are only charged beyond the free 1,000 GB, and one game uses a tiny fraction of 1 GB.

**Option B: ExpressTURN (free plan, 1 TB per month, no card)**

1. Sign up at https://www.expressturn.com and copy your TURN username and password from the dashboard.
2. In Vercel → **Settings → Environment Variables**, add:
   - `EXPRESSTURN_USERNAME` = your username
   - `EXPRESSTURN_PASSWORD` = your password
   - `EXPRESSTURN_HOST` = only if your dashboard shows a server other than `relay1.expressturn.com`
3. Redeploy.

**Check it worked:** open your game, click **Create a room**, and look under the PIN. It should say **"Relay server on"**. When phones join, the player list shows **Phone · direct** or **Phone · relay** for each one, so you can see which route each phone is using.

## If a phone still can't connect

1. Make sure the setup screen says **"Relay server on"**. If it says off, check the environment variable names and redeploy.
2. Turn off any VPN on the phone and on the laptop.
3. Use Chrome or Safari. Brave, and Firefox with strict privacy settings, can block the connection type the game uses.
4. As a quick workaround with no setup, connect the laptop and all phones to one phone's personal hotspot.

## Good to know

- **Keep the host page open.** It runs the game. Closing it ends the game for everyone.
- **Refreshing is safe.**
  - If the host page refreshes, click **Resume room** on the home page. The same PIN reopens, and phones reconnect by themselves within a few seconds. The current turn restarts from the last saved time.
  - If a phone refreshes, the player enters the PIN again and keeps their place.
- **Screens stay awake** during a game on browsers that support it.
- **Close room** on the setup screen ends the game and tells every phone.
- To try it on one computer before deploying, run `npx vercel dev` in this folder and open the local address in two browser windows: one to host and one to join. (`python3 -m http.server` also works, but without the relay function.)
- Your relay details stay in Vercel's environment variables. The `api/ice` function only answers requests from your own game page and hands out passwords that expire after 6 hours (Cloudflare).
