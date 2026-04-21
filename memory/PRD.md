# Beauty Salon Accounting App — PRD

## Original Problem Statement
تطبيق محاسبي لمحل تجميل (Beauty Salon Accounting Application)

## User Choices
- Currency: **EUR (€)**
- All features enabled (products, services, appointments, POS, customers, invoices, expenses, reports)
- Arabic RTL UI

## Architecture
- Backend: FastAPI + MongoDB (motor), JWT auth (bcrypt + PyJWT)
- Frontend: React + Shadcn/UI + Tailwind + Recharts
- Auth: JWT stored in localStorage; admin & cashier roles

## User Personas
- Salon owner/admin (full access)
- Cashier (POS, view reports, create invoices/appointments)

## Core Requirements
1. Auth with admin/cashier roles
2. Products + inventory (stock + low-stock alert)
3. Services catalog
4. Customers CRM (visits + total spent auto-tracked)
5. Appointments calendar (status: pending/confirmed/completed/cancelled)
6. POS with cart, discount, tax, multi-payment
7. Invoices with printable view + auto-numbering
8. Expense tracking
9. Financial reports with charts

## Implemented (2026-02)
- [x] JWT auth + seed admin (admin@salon.com / admin123)
- [x] Full CRUD: products, services, customers, appointments, expenses
- [x] POS page with split layout (products/services grid + cart sidebar)
- [x] Invoice creation auto-decrements stock + updates customer stats
- [x] Invoice print view (thermal-style receipt)
- [x] Dashboard with 14-day sales chart, top products, low stock alerts
- [x] Reports page with bar/pie charts
- [x] RTL Arabic UI with Tajawal/Cairo fonts + warm organic color palette
- [x] data-testid on all interactive elements

## Backlog (P1/P2)
- P1: Excel/PDF export for reports
- P1: Staff scheduling & commissions
- P2: Loyalty / membership cards
- P2: WhatsApp SMS reminders for appointments
- P2: Barcode scanning for POS
- P2: Multi-branch support

## Test Credentials
See `/app/memory/test_credentials.md`
