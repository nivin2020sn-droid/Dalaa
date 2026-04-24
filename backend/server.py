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
ARCHIVE_FILE = STORAGE_DIR / "invoices_archive.jsonl"

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


class CreateClientRequest(BaseModel):
    tss_id: Optional[str] = ""
    # Optional preferred id — if provided the backend uses it verbatim,
    # otherwise it generates a stable kasse-NN identifier.
    preferred_client_id: Optional[str] = ""


class CreateClientResponse(BaseModel):
    client_id: str
    tss_id: str
    serial_number: str
    created_at: str
    mock: bool


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


# ----------------------------------------------------------------------
# Auto-create a Fiskaly client. In real Fiskaly this hits:
#   PUT https://kassensichv.io/api/v2/clients/{uuid}
# with an OAuth2 bearer token. Until credentials arrive, we mint a
# deterministic mock id (kasse-01, kasse-02, …) and persist the mapping
# so the same device stays bound to its generated client.
# ----------------------------------------------------------------------
_CLIENTS_FILE = STORAGE_DIR / "clients.json"


def _load_clients() -> dict:
    if _CLIENTS_FILE.exists():
        try:
            return json.loads(_CLIENTS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_clients(data: dict) -> None:
    _CLIENTS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _next_client_id() -> str:
    clients = _load_clients()
    used = {v.get("client_id") for v in clients.values()}
    # Find the first free kasse-NN slot.
    for n in range(1, 1000):
        candidate = f"kasse-{n:02d}"
        if candidate not in used:
            return candidate
    return f"kasse-{uuid.uuid4().hex[:8]}"


@app.post("/api/tse/client/create", response_model=CreateClientResponse)
def tse_create_client(payload: CreateClientRequest):
    tss_id = (payload.tss_id or "").strip()
    preferred = (payload.preferred_client_id or "").strip()
    client_id = preferred or _next_client_id()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

    with _lock:
        clients = _load_clients()
        key = f"{tss_id or 'default'}::{client_id}"
        # Idempotent: if the same (tss, client) already exists, return it.
        if key not in clients:
            clients[key] = {
                "client_id": client_id,
                "tss_id": tss_id,
                "serial_number": MOCK_SERIAL if MOCK_MODE else "",
                "created_at": now,
            }
            _save_clients(clients)
        record = clients[key]

    # --------------------------------------------------------------
    # TODO (real Fiskaly wiring — replace mock branch below):
    #
    #   import httpx, uuid
    #   token = await _fiskaly_access_token()   # OAuth2 exchange
    #   new_id = str(uuid.uuid4())
    #   resp = httpx.put(
    #     f"https://kassensichv.io/api/v2/clients/{new_id}",
    #     json={"serial_number": payload.tss_id},
    #     headers={"Authorization": f"Bearer {token}"},
    #   )
    #   data = resp.json()
    #   return CreateClientResponse(client_id=data["_id"], ...)
    # --------------------------------------------------------------

    return CreateClientResponse(
        client_id=record["client_id"],
        tss_id=record["tss_id"],
        serial_number=record["serial_number"] or (MOCK_SERIAL if MOCK_MODE else ""),
        created_at=record["created_at"],
        mock=MOCK_MODE,
    )


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
# Invoice Archive — persistent external copy of every TSE-signed invoice.
# Accepts the full invoice payload from the mobile app AFTER the TSE
# envelope has been obtained. The record is stored in JSONL and can be
# exported as a ZIP of CSVs for bookkeeping / Finanzamt review.
# ----------------------------------------------------------------------
class ArchiveInvoiceRequest(BaseModel):
    invoice_number: str
    created_at: str
    customer_id: Optional[str] = ""
    customer_name: Optional[str] = ""
    cashier_id: Optional[str] = ""
    cashier_name: Optional[str] = ""
    payment_method: str = "cash"
    status: str = "active"         # "active" | "reversal"
    storno_of: Optional[str] = None
    storno_of_number: Optional[str] = None
    subtotal: Optional[float] = 0
    discount: Optional[float] = 0
    tax: Optional[float] = 0
    total: float
    net_total: float
    vat_total: float
    vat_breakdown: list[dict[str, Any]] = Field(default_factory=list)
    items: list[InvoiceItem] = Field(default_factory=list)
    # TSE envelope (signed receipts only reach here).
    tse_status: str
    tse_signature: Optional[str] = None
    tse_serial: Optional[str] = None
    tse_counter: Optional[int] = None
    tse_timestamp: Optional[str] = None
    tse_qr_code: Optional[str] = None


class ArchiveInvoiceResponse(BaseModel):
    archive_status: str      # "success"
    archived_at: str
    invoice_number: str


def _append_archive(row: dict) -> None:
    with ARCHIVE_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def _iter_archive():
    if not ARCHIVE_FILE.exists():
        return
    with ARCHIVE_FILE.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except Exception:
                continue


@app.post("/api/invoices/archive", response_model=ArchiveInvoiceResponse)
def invoices_archive(payload: ArchiveInvoiceRequest):
    archived_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    with _lock:
        _append_archive({
            "archived_at": archived_at,
            **payload.model_dump(),
            "items": [it.model_dump() for it in payload.items],
        })
    return ArchiveInvoiceResponse(
        archive_status="success",
        archived_at=archived_at,
        invoice_number=payload.invoice_number,
    )


@app.get("/api/invoices/export")
def invoices_export(
    from_: Optional[str] = Query(None, alias="from", description="YYYY-MM-DD"),
    to: Optional[str] = Query(None, description="YYYY-MM-DD"),
):
    # Validate optional date filters.
    for d in (from_, to):
        if d is not None and not _DATE_RE.match(d):
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    rows = []
    for r in _iter_archive():
        day = (r.get("created_at") or "")[:10]
        if from_ and day < from_:
            continue
        if to and day > to:
            continue
        rows.append(r)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        # invoices.csv — one row per invoice
        header = [
            "invoice_number", "created_at", "archived_at", "status", "storno_of_number",
            "customer_name", "cashier_name", "payment_method",
            "net_total", "vat_total", "total",
        ]
        lines = [",".join(header)]
        for r in rows:
            lines.append(",".join(_csv_escape(r.get(k)) for k in header))
        z.writestr("invoices.csv", "\n".join(lines) + "\n")

        # invoice_items.csv — one row per line item
        hdr2 = ["invoice_number", "name", "quantity", "unit_price", "vat_rate", "total"]
        lines2 = [",".join(hdr2)]
        for r in rows:
            for it in (r.get("items") or []):
                lines2.append(",".join(_csv_escape(v) for v in [
                    r.get("invoice_number"),
                    it.get("name"), it.get("quantity"), it.get("unit_price"),
                    it.get("vat_rate"), it.get("total"),
                ]))
        z.writestr("invoice_items.csv", "\n".join(lines2) + "\n")

        # tse_data.csv — TSE envelope per invoice
        hdr3 = [
            "invoice_number", "tse_status", "tse_signature", "tse_serial",
            "tse_counter", "tse_timestamp", "tse_qr_code",
        ]
        lines3 = [",".join(hdr3)]
        for r in rows:
            lines3.append(",".join(_csv_escape(r.get(k)) for k in hdr3))
        z.writestr("tse_data.csv", "\n".join(lines3) + "\n")

        # storno.csv — only storno rows
        hdr4 = ["invoice_number", "created_at", "storno_of_number", "total", "tse_signature"]
        lines4 = [",".join(hdr4)]
        for r in rows:
            if r.get("status") == "reversal":
                lines4.append(",".join(_csv_escape(r.get(k)) for k in hdr4))
        z.writestr("storno.csv", "\n".join(lines4) + "\n")

        # README
        z.writestr(
            "README.txt",
            "This archive contains all TSE-signed invoices submitted to\n"
            "POST /api/invoices/archive by the Dalaa Beauty mobile app.\n"
            f"Generated at: {datetime.now(timezone.utc).isoformat()}\n"
            f"Filter: from={from_ or '-'} to={to or '-'}\n"
            f"Invoice count: {len(rows)}\n",
        )
    buf.seek(0)
    filename = f"invoices_archive_{from_ or 'all'}_{to or 'all'}.zip"
    return Response(
        content=buf.read(),
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
