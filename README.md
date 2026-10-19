# Last Second Standing

A pass-the-clock party game. The host puts the game on a big screen, players join on their phones with a 4-character game PIN (or by scanning the QR code), and each player starts and stops a shared countdown. Whoever is holding the clock when it hits zero loses.

Works on any network: eduroam and other university Wi-Fi, mobile data, guest Wi-Fi, home Wi-Fi.

## How it works

This uses the same approach as the Samaggi University Challenge app.

- **The game runs on Vercel serverless functions** (`api/game.js`). Only the server changes the game.
- **Each room is stored in Upstash Redis** for 12 hours. Every change gets a version number and is saved with a compare-and-set, so two presses at the same moment can never both count.
- **The server times every press with its own clock.** Network lag on a phone doesn't change how long someone held the clock, so it's fair for everyone.
- **The big screen and the phones check for updates several times a second.** Phones check faster when it's their turn or they're next, and slower otherwise. This keeps usage low.
- Everything is ordinary HTTPS, the same as loading a website, so no network blocks it. There is no peer-to-peer connection and no relay server.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The game: home, host setup, big screen and phone screen |
| `api/game.js` | The game server (a Vercel function). No packages to install. |
| `vercel.json` | Tells Vercel not to cache old versions of the page |
| `README.md` | This guide |

## Setup (about 10 minutes, free)

### 1. Put the files on Vercel

Put `index.html`, `vercel.json` and the `api` folder at the top level of your project (not inside another folder). If you are replacing the peer-to-peer version, delete the old `api/ice.js`.

- **From GitHub:** push the files, then in Vercel use **Add New → Project** and import the repository. Leave **Framework Preset** as **Other** and the build settings empty.
- **From your computer:** run `npx vercel --prod` in this folder. If asked for a framework, choose **Other**.

### 2. Connect Upstash Redis

Choose one way.

**Option A: through Vercel (easiest)**

1. In your Vercel project, open the **Storage** tab and click **Create Database** (or **Connect Store**).
2. Choose **Upstash for Redis** (it may be listed under the Marketplace), pick the free plan and the region closest to you (for the UK, choose a London or EU region), and create it.
3. Connect it to this project. Vercel adds the environment variables `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.

**Option B: directly in Upstash (or reuse the Samaggi database)**

1. Sign in at https://console.upstash.com and create a Redis database on the free plan, or open the one you already have.
2. In the database's **REST API** section, copy the **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**.
3. In Vercel → your project → **Settings → Environment Variables**, add those two with the same names.

Sharing the database with the Samaggi app is fine. This game only uses keys that start with `lss:`.

### 3. Redeploy

Environment variables only take effect after a redeploy. In Vercel go to **Deployments**, open the latest one and click **Redeploy**.

### 4. Check it works

Open your site and click **Create a room**. If a PIN appears, everything is connected. If you see "The game server isn't connected to its storage yet", check the environment variable names from step 2 and redeploy.

## How to play

1. On the laptop or TV, open your site and click **Create a room**. A game PIN and QR code appear.
2. Players open the same address on their phones (or scan the QR code), type the PIN and a nickname, and tap **Enter**. They appear in the host's list as they join.
3. The host sets the time, the loser rule and the minimum hold, then clicks **Start game**. The host screen becomes the big countdown display.
4. The player whose turn it is gets a green **Start** button. They press it to start the clock and press **Stop** to pass it on. Everyone else sees a grey **Wait** button, and the next player gets a "You're next" warning.
5. When the clock reaches zero, every screen turns red and whoever is holding the clock loses:
   - **Loser starts next round**: everyone stays in and losses are counted.
   - **Loser is eliminated**: the game continues until one player is left.

Players without a phone can still play. Add their names on the setup screen and the host presses **Start/Stop for [name]** (or the space bar) for them.

## Good to know

- **Refreshing is safe, because the server keeps the game.**
  - If the host page refreshes or closes, open the site again and click **Resume room**. The game continues exactly where it was, even mid-turn.
  - If a phone refreshes, the PIN and nickname are filled in. The player taps **Enter** and keeps their place.
- **Time up never depends on someone pressing.** The server works out the exact moment the clock reached zero, even if a phone's last press arrives late.
- **Removing a player** (✕ on the setup screen) sends their phone back to the home screen, and they can't rejoin that room.
- **Close room** ends the game and tells every phone.
- **Free usage:** the Upstash free plan includes 500,000 commands a month, and the Vercel Hobby plan includes 1,000,000 function invocations. A game with 10 phones uses roughly 30,000–40,000 of each per hour, so about 12 hours of play a month fits in the free plans. If you play more, Upstash's pay-as-you-go plan costs very little at this scale.
- **Testing on your own computer:** run `npx vercel dev` in this folder after adding the environment variables to a `.env.local` file, then open the local address in two browser windows: one to host and one to join.
