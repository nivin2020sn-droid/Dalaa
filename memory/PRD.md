# Dalaa Beauty — Salon Accounting App

## Original problem statement
تطبيق محاسبي لمحل تجميل.
- Euro currency (€)
- Offline-first Android APK (no internet)
- GoBD compliance (German tax law: no invoice deletion, Storno reverse invoices)
- Bilingual: Arabic & German with instant RTL/LTR
- PDF invoice generator with 19% / 7% VAT breakdown
- Backup/restore (Drive or local file)
- Custom background upload, custom product image upload, shop name "Dalaa Beauty", designer credit "Bahaa Nasser"

## Architecture
- **Client-only**: React + Capacitor wrapper, deployed as Android APK.
- **Local DB**: IndexedDB via Dexie.js. No backend.
- **Auth**: bcryptjs hashed passwords stored in IndexedDB.
- **PDF**: jsPDF + html2canvas.
- **Mobile build**: Capacitor 7 + GitHub Actions CI (no Android Studio needed).

## Accounts (auto-seeded)
- **Default admin:** `dalaa-beauty` / `admin123` — username locked, password changeable from Settings.
- **Master (hidden):** `bahaa` / `12abAB!?` — invisible in UI, used only for emergency password reset of the default account.

## Implemented features (CHANGELOG)
- 2026-04: Initial full-stack build; then migrated to 100% offline (IndexedDB) with Capacitor wrapper.
- 2026-04: Arabic/German i18n with RTL/LTR toggle.
- 2026-04: GoBD-compliant invoices with Storno reverse logic (no deletion).
- 2026-04: PDF invoice export with VAT breakdown.
- 2026-04: File-based Backup/Restore (JSON export → Drive/Dropbox, import via file picker).
- 2026-04: Direct base64 image upload for product thumbnails + app background; default shop name "Dalaa Beauty"; designer footer "Bahaa Nasser".
- 2026-04: GitHub Actions workflow (`.github/workflows/android-debug-apk.yml`) — auto-builds Debug APK on push or manual dispatch. Detailed AR guide at `/app/BUILD_APK_ONLINE_AR.md`.
- 2026-04: Webpack 5 polyfills (`crypto-browserify`, `buffer`, `stream-browserify`, `process`) added to fix bcryptjs in production build.
- 2026-04: Appointments page now defaults to a **monthly calendar grid** (7×6) with day cells showing up to 3 appointments, a `+N more` overflow chip, today highlighted, prev/next/today navigation, and a day-detail dialog. List view preserved as toggle.
- 2026-04: **Account management** — Settings → حسابي card lets the user change their password (current + new + confirm). Username is shown read-only.
- 2026-04: **Hidden master account + forgot-password flow** — Login page exposes a "نسيت كلمة المرور؟" dialog that accepts master creds to reset any non-hidden account's password. Master is filtered from `listUsers`.

## Current status
Healthy. Running as offline React app + Capacitor 7 wrapper. GitHub Actions builds Debug APK on demand.

## Prioritised backlog (P0/P1/P2)
- **P1** Signed Release APK workflow (keystore setup) for Google Play distribution.
- **P1** Direct Google Drive backup (currently file-based share → Drive).
- **P2** Custom app icon + splash screen via `@capacitor/assets`.
- **P2** Weekly calendar view (hour grid) + drag-to-reschedule appointments.
- **P2** Appointment reminders / local notifications.
- **P2** Monthly & yearly GoBD tax reports export (PDF).

## Key files
- `frontend/src/db/seed.js` — user & settings seeding/migration (default admin, hidden master).
- `frontend/src/services/auth.js` — login, changePassword, resetWithMaster, listUsers (filters hidden).
- `frontend/src/services/router.js` — local in-app router mapping `/api/...` to services.
- `frontend/src/pages/Login.jsx` — username/password login + master-reset dialog.
- `frontend/src/pages/Settings.jsx` — account card (read-only username + password change), logo/background uploads, shop info, backup/restore.
- `frontend/src/pages/Appointments.jsx` — monthly calendar + list view toggle.
- `.github/workflows/android-debug-apk.yml` — CI build pipeline for Android APK.
- `BUILD_APK_ONLINE_AR.md` — Arabic build guide.

## 3rd-party integrations
None. 100% offline.
