# ============================================================
# Multi-stage Dockerfile — builds frontend and serves it via FastAPI
# Works with Railway, Render, Fly.io, any VPS with Docker.
# ============================================================

# ---- Stage 1: Build React frontend ----
FROM node:20-alpine AS frontend-build

WORKDIR /build

COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

COPY frontend/ ./

# In single-service deployment the frontend calls /api on the same domain,
# so REACT_APP_BACKEND_URL is empty → axios uses relative /api path.
ENV REACT_APP_BACKEND_URL=""
ENV GENERATE_SOURCEMAP=false
ENV CI=false

RUN yarn build


# ---- Stage 2: Python backend that also serves the built frontend ----
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for bcrypt/cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /build/build ./frontend_build

ENV STATIC_DIR=/app/frontend_build
ENV PORT=8000

WORKDIR /app/backend

EXPOSE 8000

CMD uvicorn server:app --host 0.0.0.0 --port ${PORT}
