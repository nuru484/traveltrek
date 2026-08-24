# TravelTrek - Travel & Tour Booking Platform

**TravelTrek** is a production-grade travel booking system covering tours, hotels & rooms, flights, and payments, built end-to-end by one engineer, from the PostgreSQL schema to the phone-first UI.

It is both a working product and a portfolio piece: the landing page tells the story, and the **live demo** exhibits the running system with real inventory served by its public API.

**Live:** [traveltrek.manuru.dev](https://traveltrek.manuru.dev/) · **Demo board:** [traveltrek.manuru.dev/demo](https://traveltrek.manuru.dev/demo)

---

## Table of Contents

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

## Features

### Customer experience

* Browse live tours, destinations, hotels, and flights on the public demo board - no account needed.
* Book tours, room stays (date-ranged, inventory-aware), and flights; pay with **Paystack** (cards, mobile money, bank transfer).
* Payment deadlines with automatic expiry of unpaid bookings; self-service cancellation with refund requests on paid bookings.
* Review completed trips (verified: only trips actually taken, within an edit window).
* A professional profile with travel stats, booking and payment history.

### Authentication & security

* Password login with **optional two-factor authentication** (code over email/SMS).
* **Passwordless OTP login** and **Google sign-in** for customers; minimal signup with email *or* phone.
* Short-lived JWTs in httpOnly cookies, **refresh-token rotation** with replay detection and session epochs (steal a token, every session dies).
* **Verified contact changes** - a new email is confirmed by link, a new phone by OTP, before it ever becomes a login identifier.
* Account lockout, enumeration-safe uniform 401s, rate limiting, webhook signature verification (HMAC over raw bytes).

### Staff operations (ADMIN / AGENT)

* Full inventory management: destinations, tours, hotels & rooms, flights - with cover photos via Cloudinary.
* Book and pay on behalf of customers (attributed to the acting staff member); action refund requests.
* Customer management with complete booking/payment history; review moderation.
* Role-aware **reports and dashboard**: monthly bookings, payments, top tours, needs-attention queues.

### Background automation (BullMQ + Redis)

Workers run as part of the web process by default, or as a dedicated process:

* **Booking deadline sweep** - cancels expired unpaid bookings and restores inventory.
* **Flight status** - `SCHEDULED → DEPARTED → LANDED` (plus `DELAYED`/`CANCELLED`) from departure/arrival times.
* **Tour status** - `UPCOMING → ONGOING → COMPLETED` from tour dates.
* **Notification queue** - every email/SMS is a durable job with 3 attempts and exponential backoff; failed sends stay visible in Redis.

---

## Tech Stack

| Layer                  | Technology                                                       |
| ---------------------- | ---------------------------------------------------------------- |
| **Frontend**           | Next.js (App Router) + React 19, TypeScript (strict)             |
| **UI & Styling**       | Tailwind CSS v4, shadcn/ui (Radix), next-themes, framer-motion   |
| **State & Data**       | Redux Toolkit + RTK Query (cookie auth, mutex-deduped refresh)   |
| **Forms & Validation** | react-hook-form + **Zod on both sides** of the wire              |
| **Backend**            | Node.js, Express 5 (TypeScript, ESM)                             |
| **Database**           | PostgreSQL + Prisma (pg driver adapter), soft deletes            |
| **Money**              | Integer minor units (pesewas) end-to-end - never floats          |
| **Payments**           | Paystack (initialize / verify / refund, signed webhooks)         |
| **Queue & Jobs**       | BullMQ + Redis (ioredis)                                         |
| **Media**              | Cloudinary (multer uploads, replacement/removal reclamation)     |
| **Observability**      | pino structured logs, request correlation, Sentry, health probes |
| **Testing**            | Vitest - supertest integration suite (real Postgres) + UI suite  |
| **CI**                 | GitHub Actions: lint, type-check, build, test for both apps      |

---

## Architecture Overview

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

The service layer is dependency-injected (`makeXService(deps)`) for Prisma, Paystack, Cloudinary, mail/SMS, and the clock, so the 350+ integration tests swap fakes while hitting a real database. Concurrency-sensitive writes (tour slots, flight seats, room inventory, payment settlement) use guarded atomic updates inside transactions, so double-booking and duplicate-webhook races can't oversell or double-notify.

---

## Data Model

Two principal tables, **staff** (`User`: `ADMIN`/`AGENT`) and **`Customer`**, are deliberately separated, with cross-table contact uniqueness so a public signup can never shadow a staff login.

* **Destination** - the hub (country/city) that tours, hotels, and flights hang off.
* **Tour** - typed and status-tracked, with guest capacity and an atomically-guarded `guestsBooked` counter.
* **Hotel → Room** - star ratings, amenities, per-night pricing (pesewas), and date-window room inventory.
* **Flight** - route, class, seat inventory, live status.
* **Booking** - references a tour, room, *or* flight; guest counts, stay dates, payment deadline, `PENDING → CONFIRMED → COMPLETED`/`CANCELLED`.
* **Payment** - one per booking; Paystack reference as the idempotency key; `REFUND_REQUESTED → REFUNDED` flow for customer cancellations.
* **Review** - verified, one per customer per trip, moderated by staff.

Soft deletes everywhere (a Prisma client extension auto-scopes reads); `Restrict` foreign keys so money history can't cascade away.

---

## Getting Started

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

## Testing

```bash
cd backend  && npm test     # 350+ supertest integration tests against a real
                            # dedicated Postgres DB (auto-created, truncated
                            # between tests); network egress fully mocked
cd frontend && npm test     # 200+ component & pure-logic unit tests (jsdom)
```

CI (GitHub Actions) gates every push and PR on lint, type-check, build, and tests for both apps.

---

## Deployment

* **Frontend** - Vercel (landing and `/demo` are static with 5-minute ISR).
* **Backend** - Render: web process (+ workers in-process), or set `WEB_DISABLE_WORKERS=true` and run `npm run worker` as a dedicated process.
* **Render commands** - Build Command `npm run deploy` (`npm ci --include=dev && npm run build`), Start Command `npm start` (`node build/server.js`).
* **Release order** - `prisma migrate deploy` runs from the deploy workflow, before Render is allowed to build the new code. Turn Render's own Auto-Deploy **off**, or it builds every commit the moment it lands, before CI has said anything and before migrations have run.
* **Database**: managed PostgreSQL · **Media**: Cloudinary · **Queue**: managed Redis.

### First admin on a fresh deployment

```bash
cd backend
npm run bootstrap   # creates ONE ADMIN from ADMIN_EMAIL / ADMIN_NAME, with a
                    # GENERATED temporary password printed once. Nothing else.
```

It runs from the **deploy workflow**, not from Render's build command - the
platform only installs, builds and starts. It is idempotent (an existing
account holding those contacts is left untouched) and **skips with a notice**
when the `ADMIN_*` variables are absent, which is the normal state once the
admin exists. Set `ADMIN_EMAIL` and `ADMIN_NAME` as repository secrets for the
one deploy that should create it. `npm run seed` is the development
counterpart: demo accounts plus a full catalogue, bookings, payments and
reviews.

### GitHub secrets the deploy needs

`.github/workflows/render-deploy.yml` is the only thing that may deploy: it
runs after CI passes on `main`, applies migrations, triggers Render, waits for
the build, and checks the deployed API answers. It reads these from the
repository's **`production` environment** (Settings -> Environments):

| Secret | Required | Where it comes from, and what breaks without it |
| --- | --- | --- |
| `RENDER_DEPLOY_HOOK_URL` | yes | Render -> service -> Settings -> Deploy Hook. Without it the whole workflow skips with a notice, and nothing deploys. Holding this URL is enough to trigger a deploy, so treat it as a credential. |
| `PRODUCTION_DATABASE_URL` | strongly | The Render Postgres **External** connection string (the internal one is unreachable from a GitHub runner). Without it the workflow warns and deploys **without migrating**. |
| `RENDER_API_KEY` | optional | Render -> Account Settings -> API Keys. Lets the workflow wait for the build instead of firing and forgetting, so a failed Render build fails the job. |
| `RENDER_SERVICE_ID` | optional | The `srv-…` id in the service's dashboard URL. Needed together with the API key. |
| `RENDER_HEALTH_URL` | optional | e.g. `https://api.example.com/health/ready`. The post-deploy gate: readiness touches the database, so a release that boots but cannot reach Postgres still fails. |
| `ADMIN_BOOTSTRAP_ENABLED` | only once | `true` for the single deploy that should create the first admin, then remove it. Unset (the normal state) makes the bootstrap a no-op. |
| `ADMIN_EMAIL` | with the above | The admin's address. The temporary password is generated and printed in that step's log - read it, change it at first sign-in, then delete the run. |
| `ADMIN_NAME` | with the above | The admin's name. |

Full runbook and rollback: `.github/DEPLOY.md`.

---

## Project Structure

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

## License

**MIT** - © 2026 Nurudeen Abdul-Majeed

[abdulmajeednurudeen48@gmail.com](mailto:abdulmajeednurudeen48@gmail.com)
