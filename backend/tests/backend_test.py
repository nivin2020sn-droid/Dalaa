"""Backend API tests for Beauty Salon Accounting App."""
import os
import requests
import pytest
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')
BASE = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') + '/api'

ADMIN = {"email": "admin@salon.com", "password": "admin123"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ===== AUTH =====
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{BASE}/auth/login", json=ADMIN, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
        assert data["user"]["email"] == ADMIN["email"]
        assert data["user"]["role"] == "admin"
        assert "id" in data["user"]

    def test_login_wrong(self):
        r = requests.post(f"{BASE}/auth/login", json={"email": "admin@salon.com", "password": "bad"}, timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, auth):
        r = requests.get(f"{BASE}/auth/me", headers=auth, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN["email"]
        assert "password" not in r.json()

    def test_no_auth_401(self):
        for ep in ["/auth/me", "/products", "/services", "/customers",
                   "/appointments", "/invoices", "/expenses", "/reports/dashboard"]:
            r = requests.get(f"{BASE}{ep}", timeout=15)
            assert r.status_code in (401, 403), f"{ep} -> {r.status_code}"


# ===== PRODUCTS =====
class TestProducts:
    def test_crud(self, auth):
        payload = {"name": "TEST_Lipstick", "sku": "LP1", "category": "cosmetics",
                   "cost_price": 5.0, "sale_price": 12.0, "stock": 50, "min_stock": 5}
        r = requests.post(f"{BASE}/products", json=payload, headers=auth, timeout=15)
        assert r.status_code == 200, r.text
        prod = r.json()
        assert prod["name"] == "TEST_Lipstick"
        assert prod["sale_price"] == 12.0
        assert "id" in prod
        pid = prod["id"]

        r = requests.get(f"{BASE}/products", headers=auth, timeout=15)
        assert r.status_code == 200
        assert any(p["id"] == pid for p in r.json())

        upd = dict(payload, name="TEST_Lipstick2", sale_price=15.0)
        r = requests.put(f"{BASE}/products/{pid}", json=upd, headers=auth, timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Lipstick2"
        assert r.json()["sale_price"] == 15.0

        r = requests.delete(f"{BASE}/products/{pid}", headers=auth, timeout=15)
        assert r.status_code == 200
        r = requests.get(f"{BASE}/products", headers=auth, timeout=15)
        assert not any(p["id"] == pid for p in r.json())


# ===== SERVICES =====
class TestServices:
    def test_crud(self, auth):
        payload = {"name": "TEST_Haircut", "category": "hair", "duration_minutes": 45, "price": 25.0}
        r = requests.post(f"{BASE}/services", json=payload, headers=auth, timeout=15)
        assert r.status_code == 200
        sid = r.json()["id"]
        assert r.json()["price"] == 25.0

        r = requests.get(f"{BASE}/services", headers=auth, timeout=15)
        assert any(s["id"] == sid for s in r.json())

        r = requests.put(f"{BASE}/services/{sid}", json=dict(payload, price=30.0), headers=auth, timeout=15)
        assert r.status_code == 200 and r.json()["price"] == 30.0

        r = requests.delete(f"{BASE}/services/{sid}", headers=auth, timeout=15)
        assert r.status_code == 200


# ===== CUSTOMERS =====
class TestCustomers:
    def test_crud(self, auth):
        payload = {"name": "TEST_Alice", "phone": "1234", "email": "a@a.com"}
        r = requests.post(f"{BASE}/customers", json=payload, headers=auth, timeout=15)
        assert r.status_code == 200
        cid = r.json()["id"]
        assert r.json()["total_spent"] == 0.0
        assert r.json()["visits"] == 0

        r = requests.put(f"{BASE}/customers/{cid}", json=dict(payload, name="TEST_Alice2"), headers=auth, timeout=15)
        assert r.status_code == 200 and r.json()["name"] == "TEST_Alice2"

        r = requests.delete(f"{BASE}/customers/{cid}", headers=auth, timeout=15)
        assert r.status_code == 200


# ===== APPOINTMENTS =====
class TestAppointments:
    def test_crud(self, auth):
        payload = {"customer_name": "TEST_Bob", "service_name": "TEST_Cut",
                   "date": "2026-02-01", "time": "10:00", "status": "pending"}
        r = requests.post(f"{BASE}/appointments", json=payload, headers=auth, timeout=15)
        assert r.status_code == 200
        aid = r.json()["id"]

        r = requests.get(f"{BASE}/appointments", headers=auth, timeout=15)
        assert any(a["id"] == aid for a in r.json())

        r = requests.put(f"{BASE}/appointments/{aid}",
                         json=dict(payload, status="confirmed"), headers=auth, timeout=15)
        assert r.status_code == 200 and r.json()["status"] == "confirmed"

        r = requests.delete(f"{BASE}/appointments/{aid}", headers=auth, timeout=15)
        assert r.status_code == 200


# ===== INVOICES =====
class TestInvoices:
    def test_invoice_creation_with_stock_and_customer_stats(self, auth):
        # Create product
        prod = requests.post(f"{BASE}/products", json={
            "name": "TEST_Cream", "sale_price": 20.0, "cost_price": 8.0, "stock": 10, "min_stock": 2
        }, headers=auth, timeout=15).json()
        # Create customer
        cust = requests.post(f"{BASE}/customers", json={"name": "TEST_Carol"}, headers=auth, timeout=15).json()
        # Create service
        svc = requests.post(f"{BASE}/services", json={"name": "TEST_Mani", "price": 15.0}, headers=auth, timeout=15).json()

        inv_payload = {
            "customer_id": cust["id"],
            "customer_name": cust["name"],
            "items": [
                {"item_id": prod["id"], "item_type": "product", "name": prod["name"],
                 "quantity": 3, "unit_price": 20.0, "total": 60.0},
                {"item_id": svc["id"], "item_type": "service", "name": svc["name"],
                 "quantity": 1, "unit_price": 15.0, "total": 15.0},
            ],
            "discount": 5.0, "tax": 0.0, "payment_method": "cash"
        }
        r = requests.post(f"{BASE}/invoices", json=inv_payload, headers=auth, timeout=15)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["invoice_number"].startswith("INV-")
        assert inv["subtotal"] == 75.0
        assert inv["total"] == 70.0
        assert inv["cashier_name"]
        iid = inv["id"]

        # GET single
        r = requests.get(f"{BASE}/invoices/{iid}", headers=auth, timeout=15)
        assert r.status_code == 200 and r.json()["id"] == iid

        # Stock decremented
        r = requests.get(f"{BASE}/products", headers=auth, timeout=15)
        p = next(p for p in r.json() if p["id"] == prod["id"])
        assert p["stock"] == 7

        # Customer stats updated
        r = requests.get(f"{BASE}/customers", headers=auth, timeout=15)
        c = next(c for c in r.json() if c["id"] == cust["id"])
        assert c["total_spent"] == 70.0
        assert c["visits"] == 1

        # GET list contains it
        r = requests.get(f"{BASE}/invoices", headers=auth, timeout=15)
        assert any(i["id"] == iid for i in r.json())

        # cleanup
        requests.delete(f"{BASE}/invoices/{iid}", headers=auth, timeout=15)
        requests.delete(f"{BASE}/products/{prod['id']}", headers=auth, timeout=15)
        requests.delete(f"{BASE}/services/{svc['id']}", headers=auth, timeout=15)
        requests.delete(f"{BASE}/customers/{cust['id']}", headers=auth, timeout=15)


# ===== EXPENSES =====
class TestExpenses:
    def test_crud(self, auth):
        payload = {"title": "TEST_Rent", "category": "rent", "amount": 500.0, "date": "2026-01-15"}
        r = requests.post(f"{BASE}/expenses", json=payload, headers=auth, timeout=15)
        assert r.status_code == 200
        eid = r.json()["id"]
        assert r.json()["amount"] == 500.0

        r = requests.get(f"{BASE}/expenses", headers=auth, timeout=15)
        assert any(e["id"] == eid for e in r.json())

        r = requests.put(f"{BASE}/expenses/{eid}", json=dict(payload, amount=600.0), headers=auth, timeout=15)
        assert r.status_code == 200 and r.json()["amount"] == 600.0

        r = requests.delete(f"{BASE}/expenses/{eid}", headers=auth, timeout=15)
        assert r.status_code == 200


# ===== REPORTS =====
class TestReports:
    def test_dashboard_shape(self, auth):
        r = requests.get(f"{BASE}/reports/dashboard", headers=auth, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for key in ["total_revenue", "total_expenses", "today_revenue", "month_revenue",
                    "profit", "invoices_count", "customers_count", "appointments_count",
                    "low_stock", "sales_by_day", "top_products", "top_services"]:
            assert key in d, f"missing {key}"
        assert len(d["sales_by_day"]) == 14
        assert isinstance(d["top_products"], list)
        assert isinstance(d["top_services"], list)
        assert isinstance(d["low_stock"], list)


# ===== ADMIN-ONLY DELETES =====
class TestRoleEnforcement:
    def test_cashier_cannot_delete_admin_resources(self, auth):
        # Create cashier
        cashier = {"name": "TEST_Cashier", "email": "TEST_cashier1@salon.com",
                   "password": "pass1234", "role": "cashier"}
        # cleanup if exists - login attempt (not exposed). Just try register.
        r = requests.post(f"{BASE}/auth/register", json=cashier, headers=auth, timeout=15)
        assert r.status_code in (200, 400), r.text  # 400 if exists from prior run

        # login as cashier
        r = requests.post(f"{BASE}/auth/login",
                          json={"email": cashier["email"], "password": cashier["password"]}, timeout=15)
        assert r.status_code == 200
        ctok = r.json()["token"]
        cauth = {"Authorization": f"Bearer {ctok}"}

        # admin creates a product
        prod = requests.post(f"{BASE}/products", json={"name": "TEST_Roleprod", "sale_price": 1.0},
                             headers=auth, timeout=15).json()
        # cashier delete -> 403
        r = requests.delete(f"{BASE}/products/{prod['id']}", headers=cauth, timeout=15)
        assert r.status_code == 403

        # cashier can create product (non-admin allowed by code)
        r = requests.post(f"{BASE}/products", json={"name": "TEST_Cashprod", "sale_price": 2.0},
                          headers=cauth, timeout=15)
        assert r.status_code == 200

        # cleanup
        requests.delete(f"{BASE}/products/{prod['id']}", headers=auth, timeout=15)
        requests.delete(f"{BASE}/products/{r.json()['id']}", headers=auth, timeout=15)
