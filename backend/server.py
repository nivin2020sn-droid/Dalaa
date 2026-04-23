from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta, date
import bcrypt
import jwt as pyjwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'beauty-salon-secret-key-2026')
JWT_ALGO = 'HS256'
JWT_EXPIRE_HOURS = 24 * 7

app = FastAPI(title="Beauty Salon Accounting API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


# ============ HELPERS ============
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ============ MODELS ============
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["admin", "cashier"] = "cashier"


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    sku: Optional[str] = ""
    category: Optional[str] = ""
    cost_price: float = 0.0
    sale_price: float
    stock: int = 0
    min_stock: int = 5
    image_url: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = ""
    category: Optional[str] = ""
    cost_price: float = 0.0
    sale_price: float
    stock: int = 0
    min_stock: int = 5
    image_url: Optional[str] = ""


class Service(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: Optional[str] = ""
    duration_minutes: int = 30
    price: float
    description: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class ServiceCreate(BaseModel):
    name: str
    category: Optional[str] = ""
    duration_minutes: int = 30
    price: float
    description: Optional[str] = ""


class Customer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    notes: Optional[str] = ""
    total_spent: float = 0.0
    visits: int = 0
    created_at: str = Field(default_factory=now_iso)


class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    notes: Optional[str] = ""


class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: Optional[str] = ""
    customer_name: str
    service_id: Optional[str] = ""
    service_name: str
    date: str  # ISO date string
    time: str  # HH:MM
    status: Literal["pending", "confirmed", "completed", "cancelled"] = "pending"
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class AppointmentCreate(BaseModel):
    customer_id: Optional[str] = ""
    customer_name: str
    service_id: Optional[str] = ""
    service_name: str
    date: str
    time: str
    status: Literal["pending", "confirmed", "completed", "cancelled"] = "pending"
    notes: Optional[str] = ""


class InvoiceItem(BaseModel):
    item_id: str
    item_type: Literal["product", "service"]
    name: str
    quantity: int
    unit_price: float
    total: float


class Invoice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    customer_id: Optional[str] = ""
    customer_name: Optional[str] = "عميل عابر"
    items: List[InvoiceItem]
    subtotal: float
    discount: float = 0.0
    tax: float = 0.0
    total: float
    payment_method: Literal["cash", "card", "transfer"] = "cash"
    cashier_id: Optional[str] = ""
    cashier_name: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class InvoiceCreate(BaseModel):
    customer_id: Optional[str] = ""
    customer_name: Optional[str] = "عميل عابر"
    items: List[InvoiceItem]
    discount: float = 0.0
    tax: float = 0.0
    payment_method: Literal["cash", "card", "transfer"] = "cash"


class Expense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    category: str
    amount: float
    date: str
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class ExpenseCreate(BaseModel):
    title: str
    category: str
    amount: float
    date: str
    notes: Optional[str] = ""


# ============ AUTH ============
@api_router.post("/auth/register")
async def register(body: UserCreate, _=Depends(require_admin)):
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "name": body.name,
        "email": body.email,
        "password": hash_password(body.password),
        "role": body.role,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return {"id": user_id, "name": body.name, "email": body.email, "role": body.role}


@api_router.post("/auth/login")
async def login(body: LoginReq):
    user = await db.users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")
    token = create_token(user["id"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
        },
    }


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@api_router.get("/auth/users")
async def list_users(_=Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(500)
    return users


# ============ PRODUCTS ============
@api_router.get("/products")
async def list_products(_=Depends(get_current_user)):
    items = await db.products.find({}, {"_id": 0}).to_list(1000)
    return items


@api_router.post("/products")
async def create_product(body: ProductCreate, _=Depends(get_current_user)):
    obj = Product(**body.model_dump())
    await db.products.insert_one(obj.model_dump())
    return obj.model_dump()


@api_router.put("/products/{pid}")
async def update_product(pid: str, body: ProductCreate, _=Depends(get_current_user)):
    await db.products.update_one({"id": pid}, {"$set": body.model_dump()})
    item = await db.products.find_one({"id": pid}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item


@api_router.delete("/products/{pid}")
async def delete_product(pid: str, _=Depends(require_admin)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


# ============ SERVICES ============
@api_router.get("/services")
async def list_services(_=Depends(get_current_user)):
    return await db.services.find({}, {"_id": 0}).to_list(1000)


@api_router.post("/services")
async def create_service(body: ServiceCreate, _=Depends(get_current_user)):
    obj = Service(**body.model_dump())
    await db.services.insert_one(obj.model_dump())
    return obj.model_dump()


@api_router.put("/services/{sid}")
async def update_service(sid: str, body: ServiceCreate, _=Depends(get_current_user)):
    await db.services.update_one({"id": sid}, {"$set": body.model_dump()})
    item = await db.services.find_one({"id": sid}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item


@api_router.delete("/services/{sid}")
async def delete_service(sid: str, _=Depends(require_admin)):
    await db.services.delete_one({"id": sid})
    return {"ok": True}


# ============ CUSTOMERS ============
@api_router.get("/customers")
async def list_customers(_=Depends(get_current_user)):
    return await db.customers.find({}, {"_id": 0}).to_list(5000)


@api_router.post("/customers")
async def create_customer(body: CustomerCreate, _=Depends(get_current_user)):
    obj = Customer(**body.model_dump())
    await db.customers.insert_one(obj.model_dump())
    return obj.model_dump()


@api_router.put("/customers/{cid}")
async def update_customer(cid: str, body: CustomerCreate, _=Depends(get_current_user)):
    await db.customers.update_one({"id": cid}, {"$set": body.model_dump()})
    item = await db.customers.find_one({"id": cid}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item


@api_router.delete("/customers/{cid}")
async def delete_customer(cid: str, _=Depends(require_admin)):
    await db.customers.delete_one({"id": cid})
    return {"ok": True}


# ============ APPOINTMENTS ============
@api_router.get("/appointments")
async def list_appointments(_=Depends(get_current_user)):
    return await db.appointments.find({}, {"_id": 0}).to_list(5000)


@api_router.post("/appointments")
async def create_appointment(body: AppointmentCreate, _=Depends(get_current_user)):
    obj = Appointment(**body.model_dump())
    await db.appointments.insert_one(obj.model_dump())
    return obj.model_dump()


@api_router.put("/appointments/{aid}")
async def update_appointment(aid: str, body: AppointmentCreate, _=Depends(get_current_user)):
    await db.appointments.update_one({"id": aid}, {"$set": body.model_dump()})
    item = await db.appointments.find_one({"id": aid}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item


@api_router.delete("/appointments/{aid}")
async def delete_appointment(aid: str, _=Depends(get_current_user)):
    await db.appointments.delete_one({"id": aid})
    return {"ok": True}


# ============ INVOICES ============
async def _next_invoice_number():
    count = await db.invoices.count_documents({})
    return f"INV-{(count + 1):06d}"


@api_router.get("/invoices")
async def list_invoices(_=Depends(get_current_user)):
    items = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return items


@api_router.get("/invoices/{iid}")
async def get_invoice(iid: str, _=Depends(get_current_user)):
    item = await db.invoices.find_one({"id": iid}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item


@api_router.post("/invoices")
async def create_invoice(body: InvoiceCreate, user=Depends(get_current_user)):
    # Calculate totals
    subtotal = sum(it.total for it in body.items)
    total = subtotal - body.discount + body.tax
    if total < 0:
        total = 0

    inv = Invoice(
        invoice_number=await _next_invoice_number(),
        customer_id=body.customer_id,
        customer_name=body.customer_name or "عميل عابر",
        items=body.items,
        subtotal=subtotal,
        discount=body.discount,
        tax=body.tax,
        total=total,
        payment_method=body.payment_method,
        cashier_id=user["id"],
        cashier_name=user["name"],
    )

    doc = inv.model_dump()
    # serialize items
    doc["items"] = [it.model_dump() if hasattr(it, "model_dump") else it for it in body.items]
    await db.invoices.insert_one(doc)

    # Decrement product stock
    for it in body.items:
        if it.item_type == "product":
            await db.products.update_one({"id": it.item_id}, {"$inc": {"stock": -it.quantity}})

    # Update customer stats
    if body.customer_id:
        await db.customers.update_one(
            {"id": body.customer_id},
            {"$inc": {"total_spent": total, "visits": 1}},
        )

    return inv.model_dump()


@api_router.delete("/invoices/{iid}")
async def delete_invoice(iid: str, _=Depends(require_admin)):
    await db.invoices.delete_one({"id": iid})
    return {"ok": True}


# ============ EXPENSES ============
@api_router.get("/expenses")
async def list_expenses(_=Depends(get_current_user)):
    return await db.expenses.find({}, {"_id": 0}).sort("date", -1).to_list(5000)


@api_router.post("/expenses")
async def create_expense(body: ExpenseCreate, _=Depends(get_current_user)):
    obj = Expense(**body.model_dump())
    await db.expenses.insert_one(obj.model_dump())
    return obj.model_dump()


@api_router.put("/expenses/{eid}")
async def update_expense(eid: str, body: ExpenseCreate, _=Depends(get_current_user)):
    await db.expenses.update_one({"id": eid}, {"$set": body.model_dump()})
    item = await db.expenses.find_one({"id": eid}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item


@api_router.delete("/expenses/{eid}")
async def delete_expense(eid: str, _=Depends(require_admin)):
    await db.expenses.delete_one({"id": eid})
    return {"ok": True}


# ============ REPORTS ============
@api_router.get("/reports/dashboard")
async def dashboard_report(_=Depends(get_current_user)):
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    products = await db.products.find({}, {"_id": 0}).to_list(10000)
    customers_count = await db.customers.count_documents({})
    appts_count = await db.appointments.count_documents({})

    today = datetime.now(timezone.utc).date().isoformat()
    month_prefix = today[:7]

    total_revenue = sum(i.get("total", 0) for i in invoices)
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    today_revenue = sum(i.get("total", 0) for i in invoices if i.get("created_at", "").startswith(today))
    month_revenue = sum(i.get("total", 0) for i in invoices if i.get("created_at", "").startswith(month_prefix))

    # profit: revenue - cost (for product items)
    total_cost = 0.0
    product_map = {p["id"]: p for p in products}
    product_sales_count = {}
    service_sales_count = {}
    for inv in invoices:
        for it in inv.get("items", []):
            if it.get("item_type") == "product":
                p = product_map.get(it.get("item_id"))
                if p:
                    total_cost += p.get("cost_price", 0) * it.get("quantity", 0)
                product_sales_count[it.get("name")] = product_sales_count.get(it.get("name"), 0) + it.get("quantity", 0)
            else:
                service_sales_count[it.get("name")] = service_sales_count.get(it.get("name"), 0) + it.get("quantity", 0)

    profit = total_revenue - total_cost - total_expenses
    low_stock = [p for p in products if p.get("stock", 0) <= p.get("min_stock", 0)]

    # Sales by day (last 14 days)
    today_dt = datetime.now(timezone.utc).date()
    days_map = {}
    for i in range(13, -1, -1):
        d = (today_dt - timedelta(days=i)).isoformat()
        days_map[d] = 0
    for inv in invoices:
        dt = inv.get("created_at", "")[:10]
        if dt in days_map:
            days_map[dt] += inv.get("total", 0)
    sales_by_day = [{"date": d, "revenue": v} for d, v in days_map.items()]

    top_products = sorted(product_sales_count.items(), key=lambda x: -x[1])[:5]
    top_services = sorted(service_sales_count.items(), key=lambda x: -x[1])[:5]

    return {
        "total_revenue": round(total_revenue, 2),
        "total_expenses": round(total_expenses, 2),
        "today_revenue": round(today_revenue, 2),
        "month_revenue": round(month_revenue, 2),
        "profit": round(profit, 2),
        "invoices_count": len(invoices),
        "customers_count": customers_count,
        "appointments_count": appts_count,
        "low_stock": low_stock,
        "sales_by_day": sales_by_day,
        "top_products": [{"name": n, "count": c} for n, c in top_products],
        "top_services": [{"name": n, "count": c} for n, c in top_services],
    }


# ============ SETTINGS ============
class SettingsModel(BaseModel):
    shop_name: Optional[str] = "صالون"
    tagline: Optional[str] = "نظام محاسبة التجميل"
    logo_url: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    tax_id: Optional[str] = ""
    receipt_footer: Optional[str] = "شكراً لزيارتكم • نتطلع لرؤيتكم مجدداً"


DEFAULT_SETTINGS = SettingsModel().model_dump()


@api_router.get("/settings")
async def get_settings():
    doc = await db.settings.find_one({"id": "main"}, {"_id": 0, "id": 0})
    if not doc:
        return DEFAULT_SETTINGS
    # fill any missing fields with defaults
    return {**DEFAULT_SETTINGS, **doc}


@api_router.put("/settings")
async def update_settings(body: SettingsModel, _=Depends(require_admin)):
    payload = body.model_dump()
    await db.settings.update_one({"id": "main"}, {"$set": payload}, upsert=True)
    return payload


# ============ SEED ============
async def seed_admin():
    existing = await db.users.find_one({"email": "admin@salon.com"})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "المدير",
            "email": "admin@salon.com",
            "password": hash_password("admin123"),
            "role": "admin",
            "created_at": now_iso(),
        })
        logging.info("Seeded default admin admin@salon.com / admin123")


@app.on_event("startup")
async def on_startup():
    await seed_admin()


@api_router.get("/")
async def root():
    return {"message": "Beauty Salon API", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ SERVE FRONTEND (for production single-service deployment) ============
# When STATIC_DIR is set (in Docker/production), serve the built React app so
# everything runs under ONE domain. In dev (Emergent), STATIC_DIR is not set,
# and the frontend is served separately on port 3000.
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException as _HTTPException

_static_dir_env = os.environ.get("STATIC_DIR")
if _static_dir_env:
    _static_dir = Path(_static_dir_env)
    if _static_dir.exists() and (_static_dir / "index.html").exists():
        # CRA puts hashed JS/CSS under /static/*
        _assets_dir = _static_dir / "static"
        if _assets_dir.exists():
            app.mount("/static", StaticFiles(directory=str(_assets_dir)), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def _spa_fallback(full_path: str):
            if full_path.startswith("api"):
                raise _HTTPException(status_code=404, detail="Not found")
            candidate = _static_dir / full_path
            if candidate.is_file():
                return FileResponse(str(candidate))
            return FileResponse(str(_static_dir / "index.html"))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
