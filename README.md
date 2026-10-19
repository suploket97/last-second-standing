# Last Second Standing (peer-to-peer edition)

A pass-the-clock party game. The host puts the game on a big screen, players join on their phones with a 4-character game PIN (or by scanning the QR code), and each player starts and stops a shared countdown. Whoever is holding the clock when it hits zero loses.

No accounts, no database, no server of your own. The whole game is one file: `index.html`.

## How it works

- The **host's browser is the game server.** It keeps the official clock, the player list and the scores.
- **Phones connect straight to the host's browser** (WebRTC, the same technology video calls use) and send only button presses.
- To find each other, the devices use the free public PeerJS matchmaking service once, when a phone joins. No game data is stored there.

## Put it online (5 minutes, free)

The page must be on an `https://` address so phones can reach it. Pick one option.

**Option A: Netlify Drop (easiest)**

1. Go to https://app.netlify.com/drop and sign up for free.
2. Drag the `last-second-standing-p2p` folder onto the page.
3. You get a link like `https://something.netlify.app`. Rename it under **Site configuration → Change site name** if you like.

**Option B: GitHub Pages**

1. Create a public repository on GitHub and upload `index.html`.
2. Go to **Settings → Pages**, set the source to your main branch, and save.
3. Your game appears at `https://your-name.github.io/your-repo/`.

That's all. There are no keys to paste and nothing to configure.

## How to play

1. On the laptop or TV, open your site and click **Create a room**. A game PIN and QR code appear.
2. Players open the same site on their phones (or scan the QR code), type the PIN and a nickname, and tap **Enter**. They appear in the host's list as they join.
3. The host sets the time, the loser rule and the minimum hold, then clicks **Start game**. The host screen becomes the big countdown display.
4. The player whose turn it is gets a green **Start** button. They press it to start the clock and press **Stop** to pass it on. Everyone else sees a grey **Wait** button, and the next player gets a "You're next" warning.
5. When the clock reaches zero, whoever is holding it loses:
   - **Loser starts next round**: everyone stays in and losses are counted.
   - **Loser is eliminated**: the game continues until one player is left.

Players without a phone can still play. Add their names on the setup screen and the host presses **Start/Stop for [name]** (or the space bar) for them.

## Good to know

- **Keep the host page open.** It runs the game. Closing it ends the game for everyone.
- **Refreshing is safe.**
  - If the host page refreshes, click **Resume room** on the home page. The same PIN reopens, and phones reconnect by themselves within a few seconds. The current turn restarts from the last saved time.
  - If a phone refreshes, the player enters the PIN again and keeps their place.
- **Play on the same Wi-Fi.** Direct connections work best when the big screen and the phones share a network. Some phones on mobile data, and some strict office or school networks, block direct connections. If a phone can't join, switch it to the same Wi-Fi as the host.
- **Screens stay awake** during a game on browsers that support it.
- **Close room** on the setup screen ends the game and tells every phone.
- To try it on one computer before deploying, run a small local server in this folder (for example `python3 -m http.server`) and open `http://localhost:8000` in two browser windows: one to host and one to join.
