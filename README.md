# 🌍 TravelTrek — Travel & Tour Booking Platform

**TravelTrek** is a production-grade travel booking system — tours, hotels & rooms, flights, and payments — built end-to-end by one engineer, from the PostgreSQL schema to the phone-first UI.

It is both a working product and a portfolio piece: the landing page tells the story, and the **live demo** exhibits the running system with real inventory served by its public API.

🔗 **Live:** [traveltrek.manuru.dev](https://traveltrek.manuru.dev/) · **Demo board:** [traveltrek.manuru.dev/demo](https://traveltrek.manuru.dev/demo)

---

## 📚 Table of Contents

* [Features](#-features)
* [Tech Stack](#-tech-stack)
* [Architecture Overview](#-architecture-overview)
* [Data Model](#-data-model)
* [Getting Started](#-getting-started)
* [Testing](#-testing)
* [Deployment](#-deployment)
* [Project Structure](#-project-structure)
* [License](#-license)

---

## ✨ Features

### 🧳 Customer experience

* Browse live tours, destinations, hotels, and flights on the public demo board — no account needed.
* Book tours, room stays (date-ranged, inventory-aware), and flights; pay with **Paystack** (cards, mobile money, bank transfer).
* Payment deadlines with automatic expiry of unpaid bookings; self-service cancellation with refund requests on paid bookings.
* Review completed trips (verified: only trips actually taken, within an edit window).
* A professional profile with travel stats, booking and payment history.

### 🔐 Authentication & security

* Password login with **optional two-factor authentication** (code over email/SMS).
* **Passwordless OTP login** and **Google sign-in** for customers; minimal signup with email *or* phone.
* Short-lived JWTs in httpOnly cookies, **refresh-token rotation** with replay detection and session epochs (steal a token, every session dies).
* **Verified contact changes** — a new email is confirmed by link, a new phone by OTP, before it ever becomes a login identifier.
* Account lockout, enumeration-safe uniform 401s, rate limiting, webhook signature verification (HMAC over raw bytes).

### 🛡️ Staff operations (ADMIN / AGENT)

* Full inventory management: destinations, tours, hotels & rooms, flights — with cover photos via Cloudinary.
* Book and pay on behalf of customers (attributed to the acting staff member); action refund requests.
* Customer management with complete booking/payment history; review moderation.
* Role-aware **reports and dashboard**: monthly bookings, payments, top tours, needs-attention queues.

### ⚙️ Background automation (BullMQ + Redis)

Workers run as part of the web process by default, or as a dedicated process:

* **Booking deadline sweep** — cancels expired unpaid bookings and restores inventory.
* **Flight status** — `SCHEDULED → DEPARTED → LANDED` (plus `DELAYED`/`CANCELLED`) from departure/arrival times.
* **Tour status** — `UPCOMING → ONGOING → COMPLETED` from tour dates.
* **Notification queue** — every email/SMS is a durable job with 3 attempts and exponential backoff; failed sends stay visible in Redis.

---

## 🛠️ Tech Stack

| Layer                  | Technology                                                       |
| ---------------------- | ---------------------------------------------------------------- |
| **Frontend**           | Next.js (App Router) + React 19, TypeScript (strict)             |
| **UI & Styling**       | Tailwind CSS v4, shadcn/ui (Radix), next-themes, framer-motion   |
| **State & Data**       | Redux Toolkit + RTK Query (cookie auth, mutex-deduped refresh)   |
| **Forms & Validation** | react-hook-form + **Zod on both sides** of the wire              |
| **Backend**            | Node.js, Express 5 (TypeScript, ESM)                             |
| **Database**           | PostgreSQL + Prisma (pg driver adapter), soft deletes            |
| **Money**              | Integer minor units (pesewas) end-to-end — never floats          |
| **Payments**           | Paystack (initialize / verify / refund, signed webhooks)         |
| **Queue & Jobs**       | BullMQ + Redis (ioredis)                                         |
| **Media**              | Cloudinary (multer uploads, replacement/removal reclamation)     |
| **Observability**      | pino structured logs, request correlation, Sentry, health probes |
| **Testing**            | Vitest — supertest integration suite (real Postgres) + UI suite  |
| **CI**                 | GitHub Actions: lint, type-check, build, test for both apps      |

---

## 🏗️ Architecture Overview

```
Customer / Agent / Admin browser (Next.js + RTK Query)
        │  REST /api/v1 (JWT in httpOnly cookies)
        ▼
Express API (routes → controllers → services → Prisma)
        │                                │
   PostgreSQL                       Cloudinary (media)
        │
BullMQ + Redis ── in-process, or a dedicated worker (worker.ts)
   ├── booking deadline sweep
   ├── flight status updater
   ├── tour status updater
   └── notification delivery (email/SMS, retries + backoff)
```

The service layer is dependency-injected (`makeXService(deps)`) — Prisma, Paystack, Cloudinary, mail/SMS, the clock — so the 350+ integration tests swap fakes while hitting a real database. Concurrency-sensitive writes (tour slots, flight seats, room inventory, payment settlement) use guarded atomic updates inside transactions, so double-booking and duplicate-webhook races can't oversell or double-notify.

---

## 🗄️ Data Model

Two principal tables — **staff** (`User`: `ADMIN`/`AGENT`) and **`Customer`** — deliberately separated, with cross-table contact uniqueness so a public signup can never shadow a staff login.

* **Destination** — the hub (country/city) that tours, hotels, and flights hang off.
* **Tour** — typed and status-tracked, with guest capacity and an atomically-guarded `guestsBooked` counter.
* **Hotel → Room** — star ratings, amenities, per-night pricing (pesewas), and date-window room inventory.
* **Flight** — route, class, seat inventory, live status.
* **Booking** — references a tour, room, *or* flight; guest counts, stay dates, payment deadline, `PENDING → CONFIRMED → COMPLETED`/`CANCELLED`.
* **Payment** — one per booking; Paystack reference as the idempotency key; `REFUND_REQUESTED → REFUNDED` flow for customer cancellations.
* **Review** — verified, one per customer per trip, moderated by staff.

Soft deletes everywhere (a Prisma client extension auto-scopes reads); `Restrict` foreign keys so money history can't cascade away.

---

## 🚀 Getting Started

### Prerequisites

* **Node.js** ≥ 22
* **PostgreSQL** ≥ 14
* **Redis** (BullMQ jobs and the notification queue)

### Backend

```bash
cd backend
npm install                 # also runs prisma generate
cp .env.example .env        # fill in DATABASE_URL, REDIS_URL, secrets…
npm run migrate             # apply migrations (dev)
npm run seed                # seed the default admin (from ADMIN_* env vars)
npm run dev                 # API on :4000 (workers run in-process)
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env        # NEXT_PUBLIC_SERVER_URI etc.
npm run dev                 # app on :3000
```

Each app's own README covers its env vars, scripts, and conventions in detail: [backend/README.md](backend/README.md) · [frontend/README.md](frontend/README.md).

---

## 🧪 Testing

```bash
cd backend  && npm test     # 350+ supertest integration tests against a real
                            # dedicated Postgres DB (auto-created, truncated
                            # between tests); network egress fully mocked
cd frontend && npm test     # 200+ component & pure-logic unit tests (jsdom)
```

CI (GitHub Actions) gates every push and PR on lint, type-check, build, and tests for both apps.

---

## 🌐 Deployment

* **Frontend** — Vercel (landing and `/demo` are static with 5-minute ISR).
* **Backend** — Render: web process (+ workers in-process), or set `WEB_DISABLE_WORKERS=true` and run `npm run worker` as a dedicated process.
* **Release order** — `prisma migrate deploy` runs before the new code boots (`npm run deploy`).
* **Database** — managed PostgreSQL · **Media** — Cloudinary · **Queue** — managed Redis.

---

## 📦 Project Structure

```
traveltrek/
├── frontend/            # Next.js App Router app
│   ├── src/app/         # routes: landing, /demo, /login…, /dashboard/*
│   ├── src/components/  # feature components + shadcn/ui kit
│   ├── src/redux/       # RTK Query api slices
│   └── test/            # vitest unit + component suites
│
├── backend/             # Express API + worker (TypeScript, ESM)
│   ├── prisma/          # schema, migrations, admin seed
│   ├── src/
│   │   ├── routes/  controllers/  services/   # thin HTTP → DI'd domain logic
│   │   ├── validations/  middlewares/  notifications/
│   │   ├── jobs/        # BullMQ queues, workers, schedulers, lifecycle
│   │   └── config/  lib/  utils/
│   ├── server.ts        # web entrypoint
│   ├── worker.ts        # dedicated-worker entrypoint
│   └── test/            # supertest integration suite
```

---

## 🧾 License

**MIT** — © 2026 Nurudeen Abdul-Majeed

📩 [abdulmajeednurudeen48@gmail.com](mailto:abdulmajeednurudeen48@gmail.com)
