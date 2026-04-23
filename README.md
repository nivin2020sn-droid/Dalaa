# 💅 Salon Accounting — Monorepo

Full-stack beauty salon accounting app. Arabic RTL UI, EUR currency, JWT auth, invoicing, POS, inventory, appointments, reports.

**Stack:** React 19 (CRA) · FastAPI · MongoDB · JWT · TailwindCSS · Shadcn UI · Recharts

---

## 📁 Repository Layout

```
.
├── backend/           # FastAPI service
│   ├── server.py      # All API routes (/api/*)
│   ├── requirements.txt
│   └── .env           # Local dev only — not committed
├── frontend/          # React + Tailwind + Shadcn
│   ├── src/
│   ├── public/
│   └── package.json   # Frontend deps (managed by yarn)
├── Dockerfile         # Multi-stage build (primary production path)
├── railway.json       # Railway config → uses Dockerfile
├── nixpacks.toml      # Railway/Render Nixpacks fallback
├── Procfile           # Heroku/Railway Nixpacks start command
├── package.json       # 👈 Root monorepo scripts (dev/build/start)
├── DEPLOYMENT.md      # Step-by-step deployment guide (Arabic)
└── README.md
```

---

## 🏃 Quick Start (local development)

```bash
# 1. Install everything (Python + Node)
yarn install:all

# 2. Ensure MongoDB is running locally, then create .env files:
#    backend/.env   → MONGO_URL=mongodb://localhost:27017  DB_NAME=salon_db
#    frontend/.env  → REACT_APP_BACKEND_URL=http://localhost:8001

# 3. Run both services (backend on :8001, frontend on :3000)
yarn dev
```

Default admin: `admin@salon.com` / `admin123`

---

## 🧩 Root `package.json` scripts

| Command | What it does |
|---------|--------------|
| `yarn install:all` | Installs backend (pip) and frontend (yarn) deps |
| `yarn dev` | Runs backend + frontend together via concurrently |
| `yarn dev:backend` | Starts FastAPI on `:8001` with hot reload |
| `yarn dev:frontend` | Starts React dev server on `:3000` |
| `yarn build` | Installs & builds frontend into `frontend/build` |
| `yarn build:all` | `build` + installs backend deps (used for CI/CD) |
| `yarn start` | Production start — backend serves the built frontend under `$PORT` |
| `yarn test:backend` | Runs pytest |
| `yarn lint:frontend` | ESLint on frontend |
| `yarn clean` | Removes `build/`, `node_modules/`, `__pycache__/` |

---

## 🚀 Deployment Paths

The repo supports **three** deployment methods. Pick one:

### 1. Dockerfile (recommended — works everywhere)
Used automatically by Railway (see `railway.json`). Also runs on Render, Fly.io, Cloud Run, any VPS:
```bash
docker build -t salon-app .
docker run -p 8000:8000 -e MONGO_URL="..." -e DB_NAME="salon_db" -e JWT_SECRET="..." salon-app
```

### 2. Nixpacks (Railway without Docker)
If you disable Docker in Railway's UI, `nixpacks.toml` handles the build.

### 3. Procfile (Heroku-style buildpacks)
`Procfile` + `package.json` scripts make it compatible with Heroku buildpacks.

👉 Full instructions (with MongoDB Atlas + Railway setup) in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

---

## 🔐 Required environment variables (production)

| Key | Example | Notes |
|-----|---------|-------|
| `MONGO_URL` | `mongodb+srv://user:pass@cluster.mongodb.net` | MongoDB Atlas connection string |
| `DB_NAME` | `salon_db` | Database name |
| `JWT_SECRET` | `<random 30+ chars>` | Session signing key |
| `CORS_ORIGINS` | `*` or `https://mysalon.com` | Allowed frontend origins |
| `PORT` | `8000` | Set by Railway/Render automatically |

In production, single-service deploy sets `STATIC_DIR` automatically (inside Dockerfile / nixpacks / Procfile) so that FastAPI serves the built React app on the same domain. No CORS issues.

---

## 🧪 Tested

- ✅ 12/12 backend API tests (pytest) — auth, CRUD, invoices w/ stock decrement, reports
- ✅ RTL UI renders correctly on mobile & desktop
- ✅ Docker build succeeds and serves SPA + API under one port

---

## 📄 License

Private project — all rights reserved.
