"""
Dalaa Beauty — TSE / KassenSichV Backend (Mock / Placeholder).

This service is a drop-in contract for the mobile app. It currently
returns deterministic MOCK TSE envelopes so the end-to-end flow can
be exercised without Fiskaly credentials. The real Fiskaly calls will
be wired in later — only the two helpers near the bottom need to
change, the HTTP surface stays identical.

Security notes
--------------
- No API keys or secrets are committed. Real credentials must be
  provided ONLY via Railway / hosting environment variables
  (FISKALY_API_KEY, FISKALY_API_SECRET).
- CORS defaults to "*" for developer convenience; tighten via
  CORS_ORIGINS env var in production.
- Transactions are appended to a JSONL file and the signature counter
  is persisted in a tiny state file — no database required to run.
"""
from __future__ import annotations

import hmac
import hashlib
import io
import json
import os
import re
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

load_dotenv()

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
MOCK_MODE = os.environ.get("TSE_MOCK_MODE", "true").lower() == "true"
STORAGE_DIR = Path(os.environ.get("TSE_STORAGE_DIR", "/app/backend/tse_data"))
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

STATE_FILE = STORAGE_DIR / "state.json"
TX_LOG_FILE = STORAGE_DIR / "transactions.jsonl"

# Mock TSE serial — a stable per-install identifier so multiple invoices
# share the same serial (just like a real hardware TSE would).
MOCK_SERIAL = os.environ.get("TSE_MOCK_SERIAL", "MOCK-TSE-" + uuid.uuid4().hex[:16].upper())
MOCK_PUBLIC_KEY = "MOCK-PUBKEY-" + uuid.uuid4().hex[:24].upper()
MOCK_HMAC_SECRET = os.environ.get(
    "TSE_MOCK_HMAC_SECRET",
    # Deterministic but not sensitive — used only to craft a realistic
    # looking signature string for the mock.
    "dalaa-beauty-mock-tse-do-not-use-in-production",
).encode("utf-8")

CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

# ----------------------------------------------------------------------
# Tiny file-based state (counter + tx log). Thread-safe via a single lock.
# ----------------------------------------------------------------------
_lock = Lock()


def _load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"counter": 0}


def _save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def _next_counter() -> int:
    state = _load_state()
    state["counter"] = int(state.get("counter", 0)) + 1
    _save_state(state)
    return state["counter"]


def _append_tx(row: dict) -> None:
    with TX_LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def _iter_tx():
    if not TX_LOG_FILE.exists():
        return
    with TX_LOG_FILE.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except Exception:
                continue


# ----------------------------------------------------------------------
# Pydantic models — match the contract documented in the mobile app's
# services/tse.js file.
# ----------------------------------------------------------------------
class InvoiceTotals(BaseModel):
    gross: float
    net: float
    vat: float
    by_rate: list[dict[str, Any]] = Field(default_factory=list)


class InvoiceItem(BaseModel):
    name: str
    quantity: float
    unit_price: float
    vat_rate: float
    total: float


class SignRequest(BaseModel):
    # Non-secret identifiers echoed back for traceability.
    tss_id: Optional[str] = ""
    client_id: Optional[str] = ""
    cash_register: Optional[str] = ""
    store: Optional[str] = ""
    environment: Optional[str] = "sandbox"
    # Transaction body.
    invoice_number: str
    timestamp_client: Optional[str] = None
    payment_method: str = "cash"
    totals: InvoiceTotals
    items: list[InvoiceItem] = Field(default_factory=list)
    # Optional for storno.
    storno_of: Optional[str] = None
    storno_reference: Optional[str] = None


class SignResponse(BaseModel):
    signature: str
    serial: str
    counter: int
    timestamp: str
    qr_code: str
    public_key: str
    mock: bool


# ----------------------------------------------------------------------
# Mock signer. REPLACE THIS FUNCTION (only) when wiring Fiskaly.
# ----------------------------------------------------------------------
def _sign_with_mock(payload: SignRequest, tx_type: str) -> SignResponse:
    """
    Deterministic mock: HMAC-SHA256 over the canonical JSON of the payload
    gives us a pseudo-signature. The QR code follows Fiskaly's KassenSichV
    QR-V0 layout, so the mobile app can parse/render it exactly like the
    real one.
    """
    counter = _next_counter()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

    canonical = json.dumps(
        {
            "type": tx_type,
            "invoice_number": payload.invoice_number,
            "counter": counter,
            "totals": payload.totals.model_dump(),
            "items": [it.model_dump() for it in payload.items],
            "storno_of": payload.storno_of,
            "timestamp": now,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    signature = hmac.new(MOCK_HMAC_SECRET, canonical.encode("utf-8"), hashlib.sha256).hexdigest()

    # Fiskaly-ish QR payload (V0 layout). Fields separated by ";".
    qr_code = ";".join([
        "V0",
        MOCK_SERIAL,
        tx_type,                                 # "Kassenbeleg" | "Storno"
        payload.client_id or "client-unknown",
        payload.invoice_number,
        str(counter),
        now, now,                                 # start == end for a simple tx
        "ecdsa-plain-SHA256",
        "unixTime",
        signature,
        MOCK_PUBLIC_KEY,
    ])

    return SignResponse(
        signature=signature,
        serial=MOCK_SERIAL,
        counter=counter,
        timestamp=now,
        qr_code=qr_code,
        public_key=MOCK_PUBLIC_KEY,
        mock=True,
    )


# ----------------------------------------------------------------------
# FastAPI app
# ----------------------------------------------------------------------
app = FastAPI(title="Dalaa Beauty — TSE Backend (Mock)", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Root sanity check.
@app.get("/")
def root():
    return {
        "service": "dalaa-tse-backend",
        "mock_mode": MOCK_MODE,
        "version": app.version,
        "see": ["/api/tse/health", "/api/tse/sign", "/api/tse/storno", "/api/tse/export-dsfinvk"],
    }


# ----------------------------------------------------------------------
# TSE endpoints — contract identical to what the mobile app expects.
# ----------------------------------------------------------------------
@app.get("/api/tse/health")
def tse_health():
    state = _load_state()
    return {
        "ok": True,
        "status": "ok",
        "mock": MOCK_MODE,
        "provider": "fiskaly",
        "environment": os.environ.get("FISKALY_ENVIRONMENT", "sandbox"),
        "tss_id": os.environ.get("FISKALY_TSS_ID", ""),
        "client_id": os.environ.get("FISKALY_CLIENT_ID", ""),
        "serial": MOCK_SERIAL if MOCK_MODE else None,
        "last_counter": int(state.get("counter", 0)),
        "server_time": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }


@app.post("/api/tse/sign", response_model=SignResponse)
def tse_sign(payload: SignRequest):
    with _lock:
        tse = _sign_with_mock(payload, tx_type="Kassenbeleg")
        _append_tx({
            "type": "sign",
            "tx_type": "Kassenbeleg",
            "invoice_number": payload.invoice_number,
            "signature": tse.signature,
            "counter": tse.counter,
            "serial": tse.serial,
            "timestamp": tse.timestamp,
            "qr_code": tse.qr_code,
            "totals": payload.totals.model_dump(),
            "items": [i.model_dump() for i in payload.items],
            "payment_method": payload.payment_method,
            "client_id": payload.client_id,
            "tss_id": payload.tss_id,
        })
    return tse


@app.post("/api/tse/storno", response_model=SignResponse)
def tse_storno(payload: SignRequest):
    # KassenSichV: storno is NOT a delete. It is a new signed transaction
    # that references the original. The mobile app is responsible for
    # building the negative invoice — we just sign it.
    if not payload.storno_of:
        raise HTTPException(status_code=400, detail="storno_of (original invoice number) is required")
    with _lock:
        tse = _sign_with_mock(payload, tx_type="Storno")
        _append_tx({
            "type": "storno",
            "tx_type": "Storno",
            "invoice_number": payload.invoice_number,
            "storno_of": payload.storno_of,
            "signature": tse.signature,
            "counter": tse.counter,
            "serial": tse.serial,
            "timestamp": tse.timestamp,
            "qr_code": tse.qr_code,
            "totals": payload.totals.model_dump(),
            "items": [i.model_dump() for i in payload.items],
            "payment_method": payload.payment_method,
            "client_id": payload.client_id,
            "tss_id": payload.tss_id,
        })
    return tse


# ----------------------------------------------------------------------
# DSFinV-K export — PROVISIONAL schema
# ----------------------------------------------------------------------
# A real DSFinV-K archive ships ~20 CSV files plus index.xml conforming
# to the Finanzamt spec. For the mock we provide:
#   - transactions.csv    (all signed transactions in the range)
#   - tse_clients.csv     (fake client metadata)
#   - index.xml           (placeholder)
#   - README.txt          (explains this is mock output)
#
# When wiring the real Fiskaly exporter, replace _build_mock_archive
# with a call to Fiskaly's /exports endpoint and stream the resulting
# ZIP straight through to the caller.
# ----------------------------------------------------------------------
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _csv_escape(v: Any) -> str:
    s = "" if v is None else str(v)
    if any(c in s for c in [",", "\"", "\n", "\r"]):
        return "\"" + s.replace("\"", "\"\"") + "\""
    return s


def _build_mock_archive(from_date: str, to_date: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        # transactions.csv
        header = [
            "invoice_number", "type", "counter", "serial", "timestamp",
            "payment_method", "gross", "net", "vat", "signature",
            "storno_of", "client_id", "tss_id",
        ]
        rows = [",".join(header)]
        for tx in _iter_tx():
            ts = tx.get("timestamp", "")
            if from_date and ts[:10] < from_date:
                continue
            if to_date and ts[:10] > to_date:
                continue
            totals = tx.get("totals") or {}
            rows.append(",".join(_csv_escape(v) for v in [
                tx.get("invoice_number"),
                tx.get("tx_type") or tx.get("type"),
                tx.get("counter"),
                tx.get("serial"),
                ts,
                tx.get("payment_method"),
                totals.get("gross"),
                totals.get("net"),
                totals.get("vat"),
                tx.get("signature"),
                tx.get("storno_of") or "",
                tx.get("client_id") or "",
                tx.get("tss_id") or "",
            ]))
        z.writestr("transactions.csv", "\n".join(rows) + "\n")

        # tse_clients.csv
        z.writestr(
            "tse_clients.csv",
            "client_id,serial,public_key,environment\n"
            + f"{os.environ.get('FISKALY_CLIENT_ID', 'mock-client')},{MOCK_SERIAL},"
            f"{MOCK_PUBLIC_KEY},{os.environ.get('FISKALY_ENVIRONMENT', 'sandbox')}\n",
        )

        # index.xml (placeholder)
        z.writestr(
            "index.xml",
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<DataSet>\n'
            f'  <Table name="transactions" source="transactions.csv" from="{from_date}" to="{to_date}"/>\n'
            '  <Table name="tse_clients" source="tse_clients.csv"/>\n'
            '</DataSet>\n',
        )

        # README
        z.writestr(
            "README.txt",
            "This is a MOCK DSFinV-K archive produced by the Dalaa Beauty TSE backend.\n"
            "The real archive will be generated by Fiskaly once production credentials\n"
            "are configured (FISKALY_API_KEY / FISKALY_API_SECRET in Railway env vars).\n",
        )
    buf.seek(0)
    return buf.read()


@app.get("/api/tse/export-dsfinvk")
def tse_export_dsfinvk(
    from_: str = Query(..., alias="from", description="YYYY-MM-DD"),
    to: str = Query(..., description="YYYY-MM-DD"),
):
    if not _DATE_RE.match(from_) or not _DATE_RE.match(to):
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    data = _build_mock_archive(from_, to)
    filename = f"DSFinV-K_{from_}_{to}.zip"
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ----------------------------------------------------------------------
# Diagnostics (non-contract) — useful while developing.
# ----------------------------------------------------------------------
@app.get("/api/tse/debug/transactions")
def debug_transactions(limit: int = 100):
    out = list(_iter_tx())
    return {"count": len(out), "items": out[-limit:]}
