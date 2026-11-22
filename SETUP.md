# Get Rival Roster online for free

Allow about 15–25 minutes for first-time setup. You need a Google account for Firebase and a GitHub account for publishing. Players only enter a display name. You can stay on Firebase Spark and GitHub Free throughout.

## 1. Set up Firebase

1. Open the Firebase Console and choose **Create a project**. Use any project name, such as Rival Roster. Choose or retain the **Spark** plan. Google Analytics is optional and can be disabled. [Firebase Console](https://console.firebase.google.com/)
2. On **Project overview**, choose the **Web** icon (`</>`). Register a web app named Rival Roster. Leave Firebase Hosting unchecked. You will use GitHub Pages.
3. Choose **Build → Authentication → Get started**. Open **Sign-in method**, choose **Anonymous**, enable it, and save.
4. Choose **Build → Realtime Database → Create Database**. Choose a nearby region, start in **Locked mode**, and enable it.
5. In **Realtime Database → Rules**, paste the entire contents of `firebase/database.rules.json`, then click **Publish**.
6. In **Realtime Database → Data**, click the three-dot menu at the root and choose **Import JSON**. On a **new, empty database**, use the file `firebase/seed.json`. Confirm the data tree now contains `catalog`. On a database that already contains rooms, update the `catalog` node using `firebase/catalog.seed.json`. Importing at the root can replace existing data.
7. Go to the gear icon → **Project settings → General → Your apps**. Select your web app and copy the JavaScript configuration object. Replace the placeholder values in `js/config.js`, keeping `export const firebaseConfig =`. If `databaseURL` is missing, add it using the exact HTTPS URL shown at the top of the database Data tab. A Firebase web configuration object is public client configuration. Keep service-account keys and passwords out of this file.
8. In **Authentication → Settings → Authorized domains**, add your Pages hostname, for example `yourname.github.io`. Use the hostname alone.

## 2. Publish GitHub Pages

1. Create a new **public** GitHub repository named `rival-roster`. Public repositories are covered by GitHub Free Pages. [Create a repository](https://github.com/new)
2. Upload the project files with `index.html` in the repository root. Using local Git preserves the hidden workflow directory. Extract the source ZIP, then run these commands from its `rival-roster` folder. Replace `YOUR-NAME` with your GitHub username.

   ```bash
   git init -b main
   git add .
   git commit -m "Add Rival Roster"
   git remote add origin https://github.com/YOUR-NAME/rival-roster.git
   git push -u origin main
   ```

   If you use GitHub’s upload UI instead, upload the static folders and files. In Pages settings, you can choose **Deploy from a branch**, select **main** and **/(root)**, and save.
3. For the supplied workflow, open **Settings → Pages** and choose **GitHub Actions** as the source. Open **Actions → Deploy Rival Roster to GitHub Pages → Run workflow** if the first deployment did not start automatically.
4. When the workflow succeeds, use **Settings → Pages → Visit site** to get the exact HTTPS link.

## 3. Verify with two devices

1. Open the link on device one. Click **Create Room**, enter your display name, then use **Copy link** or **WhatsApp** in the lobby.
2. Open the invite on device two. Enter a distinct display name and click **Join Room**. If using one computer, choose a separate browser profile or a private window for the second player. Two standard tabs share the same anonymous identity.
3. Save **Blind Draft** settings to show the proposal on both devices. Start the game. Each player should get turns. Recruit and assign until both rosters have five characters. Restart one browser during the game to verify the saved seat returns.
4. After the results, choose **Set up rematch** on the host device, choose **Live Auction**, and start. Both sides should show ₹100 at default settings. Place bids on both devices. Pass on both devices, or let the countdown expire. The winner should receive the character and pay the final bid. Continue until both rosters are full.
5. Compare the same final rosters on both devices. Try a strategy note in Discussion and confirm it appears for the opponent. Copy the final teams or share them through WhatsApp.

## Test locally with emulators

Install Node.js 22 or later and Java 21. These tests use a local demo project and require no Firebase credentials.

```bash
npm ci
npm test
npm run test:emulator
```

For a browser session, run `npm run preview`. In a second terminal run `npm run seed:emulator` to load the catalog into the Realtime Database emulator. Open `http://127.0.0.1:5000/?emulator=1`. For a distinct guest login in a second tab on that same browser, add `&guest=1` to the copied invite URL. Emulator mode is available on localhost only.

If room creation is disabled on your Pages site, check `js/config.js`. If sign-in fails, check the anonymous provider. If the room opens but the match fails to start, confirm the catalog import and published rules. Changes to the website require a new Pages deployment. Rules updates take effect when you publish them in Firebase.
