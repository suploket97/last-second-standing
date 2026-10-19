# Last Second Standing (peer-to-peer edition)

A pass-the-clock party game. The host puts the game on a big screen, players join on their phones with a 4-character game PIN (or by scanning the QR code), and each player starts and stops a shared countdown. Whoever is holding the clock when it hits zero loses.

No accounts, no database, no game server. The whole game is one file: `index.html`.

## How it works

- The **host's browser is the game server.** It keeps the official clock, the player list and the scores.
- **Phones connect straight to the host's browser** (WebRTC, the same technology video calls use) and send only their button presses.
- The free PeerJS service introduces a phone to the host when it joins. If a network blocks the direct link, PeerJS's free relay servers are used as a fallback automatically. No game data is stored anywhere.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole game |
| `vercel.json` | Tells Vercel not to cache old versions, so updates show up straight away |
| `README.md` | This guide |

## Deploy on Vercel

The game is a plain static site, so Vercel needs no build step.

**Option A: from GitHub (recommended)**

1. Create a GitHub repository and upload `index.html` and `vercel.json` to the top level of it (not inside a subfolder).
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

**If you already deployed the earlier version**, replace `index.html` with this one (and add `vercel.json`), then push or run `npx vercel --prod` again.

## How to play

1. On the laptop or TV, open your Vercel address and click **Create a room**. A game PIN and QR code appear.
2. Players open the same address on their phones (or scan the QR code), type the PIN and a nickname, and tap **Enter**. They appear in the host's list as they join.
3. The host sets the time, the loser rule and the minimum hold, then clicks **Start game**. The host screen becomes the big countdown display.
4. The player whose turn it is gets a green **Start** button. They press it to start the clock and press **Stop** to pass it on. Everyone else sees a grey **Wait** button, and the next player gets a "You're next" warning.
5. When the clock reaches zero, whoever is holding it loses:
   - **Loser starts next round**: everyone stays in and losses are counted.
   - **Loser is eliminated**: the game continues until one player is left.

Players without a phone can still play. Add their names on the setup screen and the host presses **Start/Stop for [name]** (or the space bar) for them.

## If a phone can't connect

The phone shows **"Your phone found the game, but this network blocked the connection"** when the network won't allow a link to the big screen. Try these in order:

1. **Put everyone on the same Wi-Fi**, including the laptop running the big screen. This is the most reliable setup for peer-to-peer.
2. **Avoid guest networks and some mesh or hotel Wi-Fi.** Many have "client isolation", which stops devices on the network from reaching each other. Use the main network instead.
3. **Turn off any VPN** on the phone and on the laptop.
4. **Use Chrome or Safari.** Brave, and Firefox with strict privacy settings, can block the connection type the game uses.
5. **No suitable Wi-Fi?** Turn on a phone's personal hotspot and connect the laptop and the other phones to it.

The game already falls back to PeerJS's free relay servers. Those are shared and sometimes busy, so for the most reliable fallback you can add your own free relay account. Open `index.html`, find the `RELAY SERVER` block, and fill in one option:

- **ExpressTURN** (free plan, 1 TB per month): sign up at https://www.expressturn.com and paste your TURN username and password into `turnUsername` and `turnPassword`.
- **Metered** (free plan, 20 GB per month): sign up at https://dashboard.metered.ca/signup?tool=turnserver and paste your credentials URL into `meteredUrl`.

This is optional. On a normal home Wi-Fi you don't need it.

## Good to know

- **Keep the host page open.** It runs the game. Closing it ends the game for everyone.
- **Refreshing is safe.**
  - If the host page refreshes, click **Resume room** on the home page. The same PIN reopens, and phones reconnect by themselves within a few seconds. The current turn restarts from the last saved time.
  - If a phone refreshes, the player enters the PIN again and keeps their place.
- **Screens stay awake** during a game on browsers that support it.
- **Close room** on the setup screen ends the game and tells every phone.
- To try it on one computer before deploying, run `npx vercel dev` (or `python3 -m http.server`) in this folder and open the local address in two browser windows: one to host and one to join.
