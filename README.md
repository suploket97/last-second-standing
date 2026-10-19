# Last Second Standing

A pass-the-clock party game. The host puts the game on a big screen, players join on their phones with a 4-character game PIN (or by scanning the QR code), and each player starts and stops a shared countdown. Whoever is holding the clock when it hits zero loses.

Anyone can join. No accounts, no app installs.

## What's in this folder

| File | What it is |
| --- | --- |
| `index.html` | The whole game: home, host setup, show screen and phone screen |
| `firebase-config.js` | Your Firebase keys go here (step 3) |
| `database.rules.json` | Security rules for the live rooms (step 2) |
| `firebase.json` | Only needed if you host on Firebase Hosting (step 4, option B) |

## Setup (about 10 minutes, free)

You need a free Google account. The free Firebase plan is enough for this game.

### 1. Create a Firebase project

1. Go to https://console.firebase.google.com and click **Create a project**.
2. Give it any name, for example `last-second-standing`. You can turn Google Analytics off.

### 2. Turn on the live database

1. In the left menu open **Build → Realtime Database** and click **Create database**.
2. Pick the location closest to your players (for the UK, choose **europe-west1**).
3. Choose **Start in locked mode** and click **Enable**.
4. Open the **Rules** tab, delete what is there, paste the full contents of `database.rules.json`, and click **Publish**.
5. Copy the database address shown at the top of the **Data** tab. It looks like `https://your-project-default-rtdb.europe-west1.firebasedatabase.app`. You need it in step 3.

### 3. Turn on guest sign-in and copy your keys

1. Open **Build → Authentication**, click **Get started**, go to **Sign-in method**, choose **Anonymous** and switch it on. This lets players join without an account.
2. Click the gear icon → **Project settings**. Under **Your apps**, click the web icon `</>`, give the app a name and click **Register app**.
3. Firebase shows a `firebaseConfig` block. Copy its values into `firebase-config.js`. Make sure `databaseURL` is the address from step 2.5 (Firebase sometimes leaves that line out).

These keys are meant to be public. The rules from step 2 are what protect the data.

### 4. Put it online

Pick one option.

**Option A: Netlify Drop (easiest, no tools)**

1. Go to https://app.netlify.com/drop and sign up for free.
2. Drag the whole `last-second-standing` folder onto the page.
3. You get a link like `https://something.netlify.app`. You can rename it in **Site configuration → Change site name**.

**Option B: Firebase Hosting (same project as the database)**

You need Node.js installed. In a terminal, inside this folder, run:

```
npm install -g firebase-tools
firebase login
firebase deploy --project YOUR-PROJECT-ID
```

Your game goes live at `https://YOUR-PROJECT-ID.web.app`. This also publishes the database rules for you.

If joining fails with a sign-in error after you deploy, open **Authentication → Settings → Authorized domains** in Firebase and add your site's domain.

## How to play

1. On the laptop or TV, open your site and click **Create a room**. A game PIN and QR code appear.
2. Players open the same site on their phones (or scan the QR code), type the PIN and a nickname, and tap **Enter**. They appear in the host's list as they join.
3. The host sets the time, the loser rule and the minimum hold, then clicks **Start game**. The host screen becomes the big countdown display.
4. The player whose turn it is gets a green **Start** button. They press it to start the clock and press **Stop** to pass it on. Phones of players who aren't up show a grey **Wait** button.
5. When the clock reaches zero, whoever is holding it loses:
   - **Loser starts next round**: everyone stays in and losses are counted.
   - **Loser is eliminated**: the game continues until one player is left.

Players without a phone can still play. Add their names on the setup screen and the host presses **Start/Stop for [name]** (or the space bar) for them.

## Good to know

- **Refreshing is safe.** A player who refreshes types the PIN again and keeps their place. If the host screen refreshes, click **Resume room** on the home page and the game continues. The current turn restarts from the last saved time.
- **Close room** on the setup screen deletes the room from the database.
- The free Firebase plan allows about 100 devices connected at the same time, which is plenty for a party game.
- To try it on your own computer before deploying, run a small local server in this folder (for example `python3 -m http.server`) and open `http://localhost:8000`. Opening `index.html` by double-clicking will not work, because the game loads `firebase-config.js` as a module.
