# TMS — Aplicație web pentru managementul intern al companiilor de logistică

Lucrare de diplomă — Universitatea Politehnica Timișoara, Tehnologia Informației,
sesiunea Iunie 2026.

**Autor:** Nistor Marius-Ionuț · **Coordonator:** ș.l.dr.ing. Cosmin Marșavina

TMS este o aplicație web pentru gestionarea internă a activității firmelor mici și
mijlocii de transport din România: comenzi de transport, parteneri (clienți și
transportatori), flotă de vehicule, generare automată a documentelor de transport
în format PDF, jurnal de activitate și audit, statistici și un modul de inteligență
artificială (predicție de profit + asistent virtual de tip chatbot RAG).

---

## Cuprins

1. [Stack tehnologic](#stack-tehnologic)
2. [Funcționalități principale](#funcționalități-principale)
3. [Arhitectură](#arhitectură)
4. [Cerințe preliminare](#cerințe-preliminare)
5. [Instalare și lansare](#instalare-și-lansare)
6. [Scripturi disponibile](#scripturi-disponibile)
7. [Testare](#testare)
8. [Structura proiectului](#structura-proiectului)
9. [Depanare](#depanare)

---

## Stack tehnologic

| Strat | Tehnologii |
|-------|-----------|
| Frontend | React 18 · Vite 5 · TypeScript strict · TailwindCSS · shadcn/ui · TanStack Query · Zustand |
| Backend | Node.js 20 LTS · Express 5 · TypeScript strict · Prisma ORM 7 · PostgreSQL 17 |
| Autentificare | JWT · bcryptjs · WebAuthn (passkeys) · TOTP MFA · OTP prin email |
| Validare | Zod (backend v4 · frontend v3) |
| Generare documente | Puppeteer (Chromium headless) · Nodemailer |
| Inteligență artificială | Python 3.11 · FastAPI · statsmodels (predicție profit) · Ollama + Llama 3.2 3B (chatbot RAG) |
| Infrastructură | Docker · Docker Compose · Nginx |
| Testare | Vitest (unitare + integrare) · Playwright (E2E) · k6 (încărcare) |

---

## Funcționalități principale

- **Gestiunea comenzilor de transport** — ciclu complet de viață, controlat printr-un
  automat de stări (DRAFT → CONFIRMED → IN_PROGRESS → COMPLETED/CANCELLED), cu validare
  operațională (vehicul, transportator, date obligatorii) înainte de pornirea cursei.
- **Generarea și expedierea documentelor** — contract de transport generat automat în
  PDF pe baza unui șablon HTML și trimis prin email transportatorului.
- **Administrarea partenerilor și a flotei** — evidența clienților, transportatorilor și
  a vehiculelor, cu dezactivare logică (nu ștergere fizică) pentru păstrarea istoricului.
- **Autentificare securizată** — parolă + MFA opțional (TOTP sau cod OTP prin email) și
  autentificare fără parolă prin passkeys (WebAuthn).
- **Jurnal de activitate și audit** — istoric complet al modificărilor asupra comenzilor
  și un registru de audit separat pentru evenimentele de securitate.
- **Arhivare automată** și **copii de rezervă** programate (locale și/sau în cloud).
- **Statistici și predicția profitului** — indicatori financiari și o prognoză a
  evoluției profitului, cu interval de încredere, pe baza datelor istorice.
- **Asistent virtual** — chatbot de tip RAG (Retrieval-Augmented Generation), rulat
  local, care răspunde pe baza documentației interne a aplicației.

---

## Arhitectură

Aplicația urmează o arhitectură client-server pe straturi, extinsă cu un strat dedicat
de inteligență artificială:

```
Browser (React SPA)
    │  HTTPS
    ▼
Frontend — Nginx + build React        (servește UI, redirecționează /api/* )
    │  REST API
    ▼
Backend — Node.js + Express           (logică de business, autentificare, validare)
    │                              │
    ▼                              ▼
PostgreSQL 17                Modul IA
                          ┌──────────────┴──────────────┐
                          │                              │
                   Python · FastAPI               Ollama (Llama 3.2 3B)
                   (predicție profit)              (asistent virtual)
```

Fiecare modul backend respectă structura `router → controller → service → DTO`, iar
accesul la baza de date se realizează exclusiv prin backend (niciun acces extern direct).

---

## Cerințe preliminare

- **Node.js 20 LTS** + **npm**
- **Docker** + **Docker Compose**
- *(opțional, doar dacă serviciul de IA rulează în afara Docker)* **Python 3.11+**

---

## Instalare și lansare

### 1. Clonarea proiectului

```bash
git clone https://github.com/mariusel9911/tms-licenta.git
cd tms-licenta
```

### 2. Configurarea variabilelor de mediu

```bash
cp .env.example backend/.env
```

Completează în `backend/.env`:
- `JWT_SECRET` — minimum 32 de caractere
  (generare: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
- `SEED_USER_PASSWORD` — parola contului de administrator (minimum 8 caractere)

Valorile implicite pentru `DATABASE_URL` funcționează direct cu baza de date din Docker Compose.

### 3. Pornirea bazei de date

```bash
docker compose up -d postgres
```

### 4. Backend — instalare, migrare, lansare

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed              # creează contul de administrator

npm run dev                # http://localhost:3001 (dezvoltare, hot reload)
# sau, pentru producție:
npm run build && npm run start
```

### 5. Frontend — instalare și lansare

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173 (dezvoltare, hot reload)
# sau, pentru producție:
npm run build && npm run preview
```

### 6. (Opțional) Modulul de inteligență artificială

```bash
docker compose up -d python-api      # predicția profitului — port 8000
docker compose up -d ollama          # asistentul virtual
docker exec -it tms_ollama ollama pull llama3.2:3b
```

### Verificare

| Serviciu | Adresă | Autentificare |
|----------|--------|---------------|
| Aplicație web | http://localhost:5173 | `admin@tms.ro` / *(parola din `SEED_USER_PASSWORD`)* |
| Backend — health check | http://localhost:3001/api/health | — |

---

## Scripturi disponibile

### Backend (`cd backend`)

| Comandă | Descriere |
|---------|-----------|
| `npm run dev` | Server de dezvoltare cu hot reload |
| `npm run build` | Compilează TypeScript → `dist/` |
| `npm run start` | Rulează build-ul compilat |
| `npm run seed` | Creează contul de administrator + configurația inițială |
| `npm test` | Rulează testele |
| `npm run test:coverage` | Rulează testele cu raport de acoperire |

### Frontend (`cd frontend`)

| Comandă | Descriere |
|---------|-----------|
| `npm run dev` | Server de dezvoltare Vite (port 5173) |
| `npm run build` | Verificare de tipuri + build de producție → `dist/` |
| `npm run preview` | Previzualizare locală a build-ului de producție |
| `npm test` | Rulează testele |
| `npm run test:coverage` | Rulează testele cu raport de acoperire |
| `npm run test:e2e` | Teste end-to-end Playwright (necesită ambele servere pornite) |

---

## Testare

Strategia de testare este structurată pe patru niveluri:

- **Teste unitare și de integrare** (Vitest) — logică de business, validare, endpoint-uri API.
- **Teste end-to-end** (Playwright) — fluxuri complete din perspectiva utilizatorului.
- **Teste de încărcare** (k6) — comportamentul sistemului sub trafic ridicat.

Este impus un prag minim de **80% acoperire de cod**, atât pentru backend, cât și pentru frontend.

---

## Structura proiectului

```
tms-licenta/
├── backend/
│   ├── prisma/               # schema.prisma, migrații, seed
│   ├── src/
│   │   ├── config/           # env, database, logger, mailer
│   │   ├── middleware/       # auth, roluri, rate-limit
│   │   ├── modules/          # un folder per domeniu (auth, orders, partners,
│   │   │                     # vehicles, backup, settings, activity, ai, users)
│   │   └── utils/
│   └── server.ts             # punct de intrare
│
├── frontend/
│   ├── src/
│   │   ├── api/               # apeluri API per modul
│   │   ├── components/        # componente React (ui, layout, per modul)
│   │   ├── pages/              # o pagină per rută
│   │   ├── hooks/               # React Query hooks
│   │   └── store/                # Zustand (doar starea de autentificare)
│   └── tests/e2e/             # teste Playwright
│
├── python-api/                 # microserviciu de inteligență artificială
│   ├── main.py                 # aplicația FastAPI
│   └── services/                # predicție profit + agregări de date
│
├── docker-compose.yml          # PostgreSQL + servicii opționale (Ollama, Python API)
└── .env.example                 # șablon de configurare
```

---

## Depanare

**Port deja utilizat**
```bash
npx kill-port 3001   # backend
npx kill-port 5173   # frontend
```

**Conexiune refuzată la baza de date**
```bash
docker ps              # verifică dacă tms_postgres rulează
docker compose up -d postgres
```

**Clientul Prisma nu e sincronizat după modificarea schemei**
```bash
cd backend && npx prisma generate
```

**`npx prisma migrate` eșuează — „No datasource URL”**
Prisma 7 necesită fișierul `prisma.config.ts` din `backend/`. Rulează comenzile Prisma
din directorul `backend/`, ca să fie detectat automat.

**Erori JWT / „invalid token”**
Schimbarea `JWT_SECRET` invalidează toate sesiunile existente — utilizatorii trebuie
să se autentifice din nou.

---

*Documentație completă a implementării, arhitecturii și deciziilor tehnice se află
în lucrarea de diplomă asociată acestui proiect.*
