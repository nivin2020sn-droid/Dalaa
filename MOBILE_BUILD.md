# 📱 Build the Android APK — Step by Step

This project has been converted into a **fully offline mobile app** using [Capacitor](https://capacitorjs.com). All data is stored locally on the device in IndexedDB — **no server, no internet needed**.

---

## 📦 What You Need (one-time setup)

Install these on your computer:
- **Node.js 20 LTS** → <https://nodejs.org>
- **Yarn** → `npm install -g yarn`
- **Android Studio** (latest) → <https://developer.android.com/studio>
  - When it opens, let it install the Android SDK (API 34+) and Gradle
- **Java JDK 17** (Android Studio usually installs this)

---

## 🏗️ Build the APK — 3 Commands

Open a terminal inside the `frontend/` folder of this project:

```bash
# 1. Install dependencies (first time only)
yarn install

# 2. Build the React bundle (creates frontend/build)
yarn build

# 3. Add Android platform (first time only)
npx cap add android

# 4. Sync your built web app into the native Android project
npx cap sync android
```

Now you have a full Android project at `frontend/android/`.

---

## ▶️ Open in Android Studio

```bash
npx cap open android
```

This opens Android Studio with the project loaded. From there:

### Option A — Debug APK (quick test)
1. Wait for Gradle sync to finish (first time takes ~5 min — Android Studio downloads build tools)
2. Top menu → **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. When done, click the **"locate"** link in the notification
4. The APK will be at: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
5. Copy this file to your phone, enable "Install unknown apps", and tap to install ✅

### Option B — Signed Release APK (for distribution)
1. **Build → Generate Signed Bundle / APK**
2. Choose **APK**
3. Create a new keystore (save the file and password — you'll need it for every future update!)
4. Choose **release** build variant
5. The final APK ends up at: `frontend/android/app/build/outputs/apk/release/app-release.apk`

---

## 🔁 Making Changes Later

Whenever you change React code:

```bash
cd frontend
yarn build
npx cap sync android
# then rebuild APK in Android Studio
```

---

## 🎨 Customize the App

### App name (already set to "صالون" in Arabic)
Edit `frontend/capacitor.config.json` → `"appName"`. After changing, run `npx cap sync`.

### App icon / splash screen
1. Install helper: `yarn add -D @capacitor/assets`
2. Put a square 1024×1024 PNG at `frontend/resources/icon.png`
3. Put a 2732×2732 PNG at `frontend/resources/splash.png`
4. Run: `npx capacitor-assets generate --android`
5. Sync: `npx cap sync android`

### Package ID (bundle name)
Edit `"appId": "com.salon.accounting"` in `capacitor.config.json`. Only change before your first Play Store upload — it identifies your app uniquely.

---

## 🔐 Default Login

The app seeds a default admin account on first launch:
- **Email:** `admin@salon.com`
- **Password:** `admin123`

**Change this password immediately** from the app after first login.

---

## 💾 Where Is My Data?

All data (products, invoices, customers, settings, logo…) is stored in **IndexedDB** on the phone itself. It survives app restarts and reboots. It is **wiped** only if:
- You uninstall the app
- You use the phone's "Clear Data" option in Android Settings

**Backup recommendation:** Use the "Export data" feature (can be added later) or periodically note down the data. For multi-device sync, you'd need to add a server back (not the scope of this offline build).

---

## ❓ Troubleshooting

| Error | Solution |
|-------|----------|
| `SDK location not found` | Android Studio → File → Project Structure → SDK Location — set Android SDK path |
| `Gradle sync failed` | File → Invalidate Caches and Restart |
| `Could not find Android SDK Build-Tools` | Android Studio → SDK Manager → install Build-Tools (latest) |
| APK installs but shows white screen | Re-run `yarn build && npx cap sync android` — the build folder was stale |
| `npx cap add android` says already exists | Delete `frontend/android/` folder and re-run |

---

**Ready to build! 🚀** If Android Studio takes forever on first Gradle sync, that's normal — it downloads ~500 MB of SDK components once.
