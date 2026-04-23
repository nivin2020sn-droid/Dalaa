# ============================================================
# Multi-stage Dockerfile — builds React frontend + runs FastAPI
# IMPORTANT: Frontend uses Create React App + craco (NOT Vite).
# Works with Railway, Render, Fly.io, Cloud Run, any Docker host.
# ============================================================

# ---------- Stage 1: Build the React (CRA) frontend ----------
FROM node:20-alpine AS frontend-build

WORKDIR /build

# Install deps first (better cache)
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

# Copy sources and build
COPY frontend/ ./

# In a single-service deploy the frontend calls /api on the SAME domain,
# so REACT_APP_BACKEND_URL must be empty → axios uses relative /api path.
ENV REACT_APP_BACKEND_URL=""
ENV GENERATE_SOURCEMAP=false
ENV CI=false
ENV NODE_OPTIONS=--openssl-legacy-provider

RUN yarn build


# ---------- Stage 2: Python backend that serves the built frontend ----------
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for bcrypt/cryptography wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps (cached layer)
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --upgrade pip && pip install -r ./backend/requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from stage 1
COPY --from=frontend-build /build/build ./frontend_build

# Tell FastAPI where the static files live
ENV STATIC_DIR=/app/frontend_build
ENV PORT=8000

EXPOSE 8000

# Use shell form so $PORT gets expanded at runtime (Railway sets PORT)
CMD cd /app/backend && uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}
