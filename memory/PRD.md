# Dalaa Beauty — Salon Accounting App + TSE Backend

## Original problem statement
تطبيق محاسبي لمحل تجميل ("Dalaa Beauty") مع:
- Euro (€), offline-first Android APK
- GoBD compliance (Storno only, no deletion)
- Bilingual AR/DE with RTL/LTR
- PDF + WhatsApp + Email invoice sharing
- Backup/restore + hourly auto-backup
- Full German KassenSichV TSE integration (currently mock, ready for Fiskaly)

## Architecture
- **Frontend**: `/app/frontend/` — React 19 + Capacitor 7 (Android) + Dexie IndexedDB.
- **Backend**: `/app/backend/` — FastAPI. In-app TSE mock signer + DSFinV-K export.
- **APK Build**: GitHub Actions (`/app/.github/workflows/android-debug-apk.yml`).
- **Deploy**: Backend ready for Railway (Procfile + railway.json + runtime.txt in `/app/backend/`).

## Accounts (auto-seeded)
- **Admin**: `dalaa-beauty` / `admin123` — username locked, no access to `/settings`.
- **Master Developer**: `bahaa` / `12abAB!?` — hidden from UI, full access to all technical settings.

## Implemented features (CHANGELOG)
- 2026-04: Migration to 100% offline Capacitor app (IndexedDB/Dexie).
- 2026-04: Bilingual (AR/DE) with instant RTL/LTR, custom fonts.
- 2026-04: GoBD invoicing with Storno. PDF export (jsPDF). File backup/restore.
- 2026-04: Base64 product image uploads, custom app background + login background.
- 2026-04: GitHub Actions workflow → Debug APK build on CI. Webpack 5 polyfills for bcryptjs.
- 2026-04: Monthly calendar view for Appointments + list toggle.
- 2026-04: Account management (password change + master-reset via forgot-password flow).
- 2026-04: Arabic/German locale-aware date formatting on invoices.
- 2026-04: Compact invoice layout — fits one A4 page. Smart PDF scaling.
- 2026-04: WhatsApp + Email share buttons on invoice (native share sheet + mailto fallback).
- 2026-04: Prices now stored as GROSS (Brutto, inkl. MwSt). Invoice auto-shows net + VAT breakdown.
- 2026-04: Annual German tax report page `/reports/yearly-tax` (per-rate + per-month breakdown).
- 2026-04: App icon & splash generated via `@capacitor/assets`; logo embedded as default.
- 2026-04: TSE / KassenSichV skeleton — settings card, DB schema (tse_* fields), UI wiring.
- 2026-04: Role-based access control — `/settings` master-only with route guard + service guard + sidebar conditional rendering.
- 2026-04: Settings updates audit-logged with old/new diffs.
- 2026-04: **Auto-backup scheduler** — hourly, numbered (`backup_000001_YYYY-MM-DD_HH-MM.db`), configurable folder, Backup Now button, success/failure tracked.
- 2026-04: **TSE Mock Backend deployed** — FastAPI at `/app/backend/server.py`, 4 endpoints (`/health`, `/sign`, `/storno`, `/export-dsfinvk`), HMAC-SHA256 mock signatures, Fiskaly-format QR codes, transaction JSONL log, DSFinV-K ZIP export. End-to-end tested: invoice INV-000001 signed with Serial MOCK-TSE-… + counter + QR on receipt.
- 2026-04: **Railway deploy artifacts** — `Procfile`, `railway.json`, `runtime.txt`, README in Arabic.

## Current status
Healthy. All endpoints live and tested. Mock TSE successfully signs invoices through the full flow.

## Prioritised backlog (P0/P1/P2)
- **P0** Replace `_sign_with_mock()` with real Fiskaly v2 API calls when credentials arrive.
- **P1** Persistent storage for TSE transaction log (Volume on Railway or Postgres) — GoBD 10-year retention.
- **P1** Real DSFinV-K archive schema (currently minimal mock: 4 files).
- **P1** Register cashier system with Finanzamt (Meldepflicht post-2025) — guide user through the form.
- **P2** Release APK signing (keystore) for Google Play distribution.
- **P2** Weekly calendar view with drag-to-reschedule.
- **P2** Audit Log UI (read-only) under Reports.
- **P2** Browse & restore saved local backups directly from Settings.

## Key files
- `backend/server.py` — FastAPI TSE mock signer + DSFinV-K exporter.
- `backend/README.md` — Railway deploy instructions in Arabic.
- `frontend/src/services/tse.js` — Client for backend, contract documented in JSDoc.
- `frontend/src/services/backup.js` — Hourly scheduler + numbered backups.
- `frontend/src/services/auth.js` — `requireMaster()` guard.
- `frontend/src/services/settings.js` — Master-only fields + audit-logged updates.
- `frontend/src/pages/Settings.jsx` — TSE card + Auto-backup card (master-only route).
- `frontend/src/pages/Account.jsx` — Simple password-change page for admin.
- `frontend/src/pages/YearlyTaxReport.jsx` — Annual tax report + DSFinV-K download button.
- `frontend/src/pages/InvoiceView.jsx` — QR + TSE signature block printed on receipt.
- `frontend/src/App.js` — `<MasterOnly>` route guard + `BootEffects` starts backup scheduler.
- `frontend/src/layout/Layout.jsx` — Role-based nav (Settings hidden from admin).

## 3rd-party integrations
- **Capacitor plugins** installed: `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/core`.
- **TSE**: Fiskaly (cloud, KassenSichV DE) — currently mock until credentials supplied.
- **PDF**: jsPDF + html2canvas.
- **QR Code**: `qrcode.react`.
