# PLANNING.md — TMS Transport Management System

---

## 1. Vision

### Problem Statement
The client is a Romanian logistics company (Bocoiu Group SRL) that currently manages
transport orders using CargoTrack — an existing SaaS platform. The goal is to build a
**custom, privately-owned alternative** that is simpler, more user-friendly, and tailored
exactly to their workflow, without paying recurring SaaS licensing fees for a platform with
features they do not need.

### Product Vision
A clean, fast, single-tenant web application that allows a small dispatching team to:
- Register and track transport orders from creation to completion
- Manage a database of clients and transporters (unified as "partners")
- Oversee their vehicle fleet
- Generate consolidated invoices through SmartBill (their existing invoicing software)
- View a full activity history for every order

### Design Philosophy
- **Simple over feature-rich** — only build what the client actually uses
- **Fast to operate** — dispatchers should be able to create an order in under 60 seconds
- **Familiar layout** — inspired by CargoTrack so the team adapts quickly
- **Reliable invoicing** — SmartBill integration must be robust with clear error states and retry capability

### Target Users
| Role | Description |
|------|-------------|
| **Admin** | Developer / super-admin. Manages users, configures company settings and SmartBill credentials. Full access. |
| **Dispatcher** | Day-to-day operator. Creates and manages orders, partners, vehicles. Cannot access system settings or user management. |

### Out of Scope (v1)
- Mobile application
- Real-time GPS tracking
- Driver mobile app / driver portal
- Multi-tenant / multi-company support
- Automated route optimization
- Customer-facing order tracking portal
- Accounting module beyond SmartBill integration

---

## 2. Core Features

### 2.1 Order Management
The central feature. Every transport job is an Order.
- Create, edit, duplicate, and cancel orders
- Each order records: client, transporter, vehicle, driver (text), pickup and delivery addresses with countries and dates, distance, client price, transporter price
- Status workflow: `Draft → Confirmed → In Progress → Completed → Cancelled`
- Auto-generated sequential order numbers (format: `BGR315861`)
- Full activity log / timeline per order (who did what and when)
- Filters: search by partner name, order number, reference; filter by status, date range
- Export to CSV
- Archived orders view (cancelled orders separated)

### 2.2 Partner Management
A unified table for both clients and transporters.
- Partner types: `Client`, `Transporter`, or `Both`
- Full company profile: fiscal code, registration number, name, address, contact details, payment terms, price/km, bank details
- VIES integration: auto-fill company info by entering a EU VAT number
- 316+ partners expected in the system

### 2.3 Vehicle Fleet Management
- Full vehicle profiles: license plate, VIN, make, model, year, emissions standard, axles, category, fuel type
- Loading capacity: dimensions (L/W/H), max weight
- Consumption tracking: tank capacity, L/100km, rate per km
- Link vehicles to transporter partners (owner)
- Vehicle statuses: Available, On Route, Maintenance, Inactive

### 2.4 Invoicing via SmartBill
- Select multiple completed orders for the same client
- Generate a consolidated invoice (one invoice = many orders, one line per order)
- Send directly to SmartBill API (Platinum plan, 700 docs/month)
- Download the resulting PDF from SmartBill
- Invoice statuses: Draft → Sent to SmartBill → Issued / Error
- Retry mechanism for failed submissions
- Local PDF fallback (Puppeteer) if SmartBill is unavailable

### 2.5 Settings
- Company information (displayed on invoices): name, VAT code, registration number, address, IBAN, bank, SWIFT, logo
- SmartBill API credentials: email, API token, invoice series, CIF
- Default invoice settings: VAT%, currency, payment days

### 2.6 User Management (Admin only)
- Create and manage dispatcher accounts
- Role assignment: Admin / Dispatcher
- Deactivate users (soft delete)
- Admin password reset for any user

---

## 3. Architecture

### 3.1 Overview

```
┌─────────────────────────────────────────────────┐
│                   Ubuntu Server                  │
│                                                  │
│  ┌──────────┐      ┌────────────────────────┐   │
│  │          │      │      Nginx             │   │
│  │ Browser  │─────►│  Port 80/443           │   │
│  │          │      │  - Serves React build  │   │
│  └──────────┘      │  - Proxies /api/ →     │   │
│                    │    localhost:3001       │   │
│                    └────────────┬───────────┘   │
│                                 │               │
│                    ┌────────────▼───────────┐   │
│                    │   Node.js / Express    │   │
│                    │   Port 3001 (PM2)      │   │
│                    │   TypeScript backend   │   │
│                    └────────────┬───────────┘   │
│                                 │               │
│                    ┌────────────▼───────────┐   │
│                    │     PostgreSQL 16       │   │
│                    │     Port 5432           │   │
│                    │     (local only)        │   │
│                    └────────────────────────┘   │
└─────────────────────────────────────────────────┘
           │                        │
           ▼                        ▼
  SmartBill API              EU VIES API
  ws.smartbill.ro            ec.europa.eu
  (invoice creation)         (VAT validation)
```

### 3.2 Frontend Architecture

The frontend is a **Single Page Application (SPA)** built with React and Vite.

```
React SPA
├── React Router v6          — Client-side routing
├── TanStack Query v5         — Server state (fetch, cache, sync)
├── Zustand v4                — Client state (auth token + user only)
├── React Hook Form + Zod     — Form state + validation
├── Axios                     — HTTP client with JWT interceptors
└── shadcn/ui + TailwindCSS   — UI components + styling
```

**Data flow:**
```
User interaction
      │
      ▼
React Component
      │
      ▼
React Query Hook (useOrders, usePartners, etc.)
      │
      ▼
API function (orders.api.ts)
      │
      ▼
Axios client (with JWT header injected by interceptor)
      │
      ▼
Backend REST API  →  Response cached by React Query
```

### 3.3 Backend Architecture

The backend is a **REST API** structured in domain modules.

```
Express App
├── Global middleware        — helmet, cors, json parser, logger, auth
└── Modules (per domain)
    └── [module]/
        ├── router.ts        — Route definitions + middleware
        ├── controller.ts    — HTTP layer: parse, validate (Zod), respond
        ├── service.ts       — Business logic + Prisma queries
        └── dto.ts           — Zod schemas for input validation
```

**Request lifecycle:**
```
HTTP Request
      │
      ▼
auth.middleware  →  Verify JWT, attach req.user
      │
      ▼
role.middleware  →  Check role if route requires ADMIN
      │
      ▼
Controller      →  Zod parse(req.body), call service
      │
      ▼
Service         →  Business logic, Prisma queries
      │
      ▼
Prisma ORM      →  Type-safe SQL queries → PostgreSQL
      │
      ▼
Controller      →  res.json({ success, data })
```

### 3.4 Database Architecture

PostgreSQL with Prisma ORM. Single database, single schema.

```
┌──────────┐       ┌──────────┐       ┌──────────┐
│   User   │       │ Partner  │       │ Vehicle  │
│          │       │          │       │          │
│ id       │       │ id       │       │ id       │
│ email    │       │ name     │       │ plate    │
│ role     │       │ type     │       │ make     │
│ password │       │ fiscal.. │       │ model    │
└────┬─────┘       └────┬─────┘       └────┬─────┘
     │                  │  ╲                │
     │            client│   ╲transporter    │
     │                  │    ╲              │
     │            ┌─────▼─────▼────────────▼──┐
     └───────────►│           Order            │
     createdBy    │                            │
                  │ id, orderNumber, status    │
                  │ pickupAddress, pickupDate  │
                  │ deliveryAddress, delivDate │
                  │ driverName (text)          │
                  │ clientPrice, transpPrice   │
                  └────────┬──────────┬────────┘
                           │          │
              ┌────────────┘          └──────────────┐
              │                                      │
     ┌────────▼────────┐                  ┌──────────▼──────┐
     │  ActivityLog    │                  │  InvoiceItem    │
     │                 │                  │                 │
     │ orderId         │                  │ orderId         │
     │ userId          │                  │ invoiceId       │
     │ action          │                  │ description     │
     │ createdAt       │                  │ unitPrice       │
     └─────────────────┘                  └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │    Invoice      │
                                          │                 │
                                          │ partnerId       │
                                          │ smartbillSeries │
                                          │ smartbillNumber │
                                          │ status          │
                                          │ totalAmountEur  │
                                          └─────────────────┘

                                          ┌─────────────────┐
                                          │  AppSettings    │
                                          │  (id = 1)       │
                                          │                 │
                                          │ companyName     │
                                          │ smartbillEmail  │
                                          │ smartbillToken  │
                                          └─────────────────┘
```

### 3.5 Authentication Architecture

```
Login Request (email + password)
        │
        ▼
bcrypt.compare(password, hash)
        │
        ▼
JWT signed with JWT_SECRET  (expires 8h)
        │
        ▼
Stored in localStorage via Zustand store
        │
        ▼
Attached to every request as:
  Authorization: Bearer <token>
        │
        ▼
auth.middleware.ts verifies on every protected route
```

No refresh tokens in v1 — session expires after 8 hours and the user must log in again. Acceptable for an internal business tool.

### 3.6 SmartBill Integration Architecture

```
invoices.service.ts (orchestrator)
        │
        ├─► Creates Invoice + InvoiceItems in DB  (status: DRAFT)
        │
        └─► smartbill.service.ts
                │
                ├─► POST /api/invoice      → creates invoice in SmartBill
                │       │
                │   success: save series + number, status → ISSUED
                │   error:   save error message, status → ERROR
                │
                ├─► GET /api/invoice/pdf   → download PDF bytes
                │
                └─► DELETE /api/invoice   → cancel invoice

pdf.service.ts (fallback)
        │
        └─► Puppeteer renders HTML invoice template → PDF buffer
            Used when: SmartBill is down, or status is ERROR
```

---

## 4. Technology Stack

### Backend

| Layer | Technology | Version | Reason |
|-------|-----------|---------|--------|
| Runtime | Node.js | 20 LTS | Stable LTS, excellent ecosystem |
| Framework | Express | 4.x | Minimal, widely understood, easy to customize |
| Language | TypeScript | 5.x strict | Type safety, better DX, catches bugs early |
| ORM | Prisma | 5.x | Type-safe queries, great migrations, auto-generated client |
| Database | PostgreSQL | 16 | Relational data fits perfectly, robust, free |
| Validation | Zod | 3.x | Schema-first validation, works on both FE and BE |
| Auth | jsonwebtoken + bcryptjs | 9.x / 2.x | Lightweight, no external dependency |
| PDF | Puppeteer | 21.x | Renders HTML → PDF, full CSS support for invoice template |
| HTTP client | Axios | 1.x | SmartBill API + VIES calls with timeout support |
| Security | Helmet + CORS | 7.x / 2.x | HTTP security headers, CORS policy |
| Process manager | PM2 | latest | Production process management, auto-restart, logs |

### Frontend

| Layer | Technology | Version | Reason |
|-------|-----------|---------|--------|
| Build tool | Vite | 5.x | Extremely fast dev server and build |
| UI framework | React | 18.x | Industry standard, huge ecosystem |
| Language | TypeScript | 5.x strict | Type safety across the full stack |
| Styling | TailwindCSS | 3.x | Utility-first, fast to build professional UIs |
| Component library | shadcn/ui | latest | Accessible, customizable, Tailwind-native |
| Routing | React Router | 6.x | Standard for React SPAs |
| Server state | TanStack Query | 5.x | Caching, background refetch, loading/error states |
| Client state | Zustand | 4.x | Minimal store for auth — no Redux overhead |
| Forms | React Hook Form | 7.x | Performant forms with minimal re-renders |
| Validation | Zod | 3.x | Shared schemas between FE and BE |
| Icons | lucide-react | latest | Clean, consistent icon set, tree-shakeable |
| Date utils | date-fns | 3.x | Lightweight date formatting and manipulation |
| HTTP client | Axios | 1.x | Interceptors for JWT injection + 401 handling |

### Infrastructure

| Component | Technology | Reason |
|-----------|-----------|--------|
| Web server | Nginx | Serves static build, reverse proxies API, SSL termination |
| SSL | Let's Encrypt (Certbot) | Free, auto-renewing HTTPS certificates |
| OS | Ubuntu 22.04 LTS | Stable, well-documented for Node.js deployments |
| Local dev DB | Docker + docker-compose | Isolated PostgreSQL + pgAdmin without local install |
| Production DB | PostgreSQL 16 (native) | Direct install on server, no Docker overhead in production |

### External Services

| Service | Purpose | Plan Required |
|---------|---------|--------------|
| SmartBill | Invoice creation and PDF generation | Platinum (~8.94 €/month + VAT) |
| EU VIES | VAT number validation + company data auto-fill | Free (public API) |

---

## 5. Required Tools

### Development Machine

| Tool | Purpose | Install |
|------|---------|---------|
| **Node.js 20 LTS** | Run backend and frontend dev servers | [nodejs.org](https://nodejs.org) or `nvm` |
| **npm** | Package manager (comes with Node.js) | Included with Node.js |
| **Git** | Version control | [git-scm.com](https://git-scm.com) |
| **Docker Desktop** | Local PostgreSQL + pgAdmin | [docker.com](https://docker.com) |
| **VS Code** (or WebStorm) | Code editor | [code.visualstudio.com](https://code.visualstudio.com) |
| **Postman** (or Bruno) | API testing during development | [postman.com](https://postman.com) |

### Recommended VS Code Extensions

| Extension | Purpose |
|-----------|---------|
| **Prisma** | Syntax highlighting + formatting for `schema.prisma` |
| **ESLint** | Linting TypeScript |
| **Prettier** | Code formatting |
| **Tailwind CSS IntelliSense** | Autocomplete for Tailwind classes |
| **Thunder Client** | Lightweight API testing inside VS Code |
| **GitLens** | Enhanced Git history and blame |
| **Error Lens** | Inline error display |

### Production Server

| Tool | Purpose | Install command |
|------|---------|----------------|
| **Ubuntu 22.04 LTS** | Operating system | — |
| **Node.js 20 LTS** | Run the backend | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash -` |
| **npm** | Package management | Included with Node.js |
| **PostgreSQL 16** | Database | `sudo apt install postgresql-16` |
| **Nginx** | Web server + reverse proxy | `sudo apt install nginx` |
| **Certbot** | SSL certificate (Let's Encrypt) | `sudo apt install certbot python3-certbot-nginx` |
| **PM2** | Node.js process manager | `npm install -g pm2` |
| **Google Chrome / Chromium** | Required by Puppeteer for PDF | `sudo apt install chromium-browser` |
| **Git** | Pull code from repository | `sudo apt install git` |

### External Accounts & Credentials Required

| Service | What you need | Where to get it |
|---------|--------------|----------------|
| **SmartBill** | Platinum plan subscription | [smartbill.ro](https://smartbill.ro) |
| **SmartBill** | API Token | SmartBill → My Account → Integrations |
| **SmartBill** | Company CIF (fiscal code) | Already in their account |
| **Domain name** | yourdomain.ro | Any Romanian domain registrar |
| **VPS / Server** | Ubuntu 22.04 with min. 2GB RAM | Any provider (Hetzner, DigitalOcean, etc.) |

---

## 6. Non-Functional Requirements

### Performance
- Page load under 2 seconds on a standard office connection
- Order list renders 1,450+ records with pagination (20 per page) without lag
- SmartBill API calls do not block the UI — show loading state during submission

### Security
- All API routes protected by JWT authentication (except login)
- Passwords hashed with bcrypt (cost factor 12)
- HTTP security headers via Helmet
- CORS restricted to the frontend domain only
- SmartBill API token stored in the database, never in frontend code
- HTTPS enforced in production via Nginx + Let's Encrypt

### Reliability
- SmartBill invoice failures are captured and stored — never silently lost
- Failed invoices can be retried from the UI
- Local PDF fallback if SmartBill API is down
- PM2 auto-restarts the backend if it crashes

### Maintainability
- TypeScript strict mode on both frontend and backend
- Prisma migrations keep DB schema changes tracked and reproducible
- All business logic in services, not in controllers or components
- CLAUDE.md kept up to date as the project evolves

### Scalability (future considerations)
- Current design: single server, single tenant
- Future scale path: move PostgreSQL to managed service (e.g., Supabase, RDS), containerize with Docker, add load balancer
- No architectural changes needed for up to ~10 concurrent users

---

## 7. Development Workflow

### Branch Strategy
```
main          ← production-ready code only
develop       ← integration branch
feature/*     ← individual features (e.g., feature/orders-module)
fix/*         ← bug fixes
```

### Environment Flow
```
Local (Docker PostgreSQL)
        │
        ▼
Staging (optional — same server, different port)
        │
        ▼
Production (Nginx + PM2 + PostgreSQL native)
```

### Deployment Process (production)
```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
cd backend && npm ci
cd ../frontend && npm ci

# 3. Apply DB migrations
cd backend && npx prisma migrate deploy

# 4. Build frontend
cd ../frontend && npm run build
cp -r dist/* /var/www/tms/

# 5. Rebuild and restart backend
cd ../backend && npm run build
pm2 restart tms-backend
```

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| SmartBill API unavailability | Low | Medium | Local PDF fallback + retry mechanism |
| SmartBill rate limit hit (3 calls/sec) | Low | Low | Sequential processing + delay between calls |
| Client upgrades SmartBill plan later | N/A | N/A | Credentials stored in DB, configurable from UI |
| EU VIES service timeout | Medium | Low | 10s timeout + graceful fallback (manual entry) |
| Server disk space for Puppeteer PDFs | Low | Low | Clean up old local PDFs after SmartBill confirms |
| Puppeteer missing Chrome on server | Medium | High | Document install steps, add to deployment checklist |
| Data loss on single server | Medium | High | Set up automated PostgreSQL backups (pg_dump cron) |
