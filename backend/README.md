# TravelTrek Backend

Express 5 + TypeScript (ESM) API and background worker for the TravelTrek booking platform. PostgreSQL via Prisma, BullMQ on Redis, Paystack payments, Cloudinary media.

## Layout

```
routes → controllers → services → prisma
```

* **Routes** (`src/routes/`) mount paths and role gates (`authorizeRole`); auth flows live under `src/routes/authentication/`.
* **Controllers** (`src/controllers/`) are thin: multer/photo middleware where relevant, zod validation, call a service, send the `{ message, data, meta? }` envelope.
* **Services** (`src/services/`) own all domain logic as DI'd factories. `makeXService(deps)` receives Prisma, Paystack, Cloudinary, the notification client, and the clock (`src/services/deps.ts`), so tests swap fakes while hitting a real database. Services throw typed `CustomError`s and never touch `req`/`res`.
* **Validations** (`src/validations/`): Zod at the boundary, written back onto the request so handlers read typed values.
* **Mappers** (`src/utils/mappers/`): DTO + Prisma `select` shapes per domain, so wire formats are decoupled from rows.

Domains: auth, users (staff), customers, destinations, tours, hotels, rooms, flights, bookings, payments, reviews, reports, dashboard, and an unauthenticated `public` browse surface for the demo board.

## Things the code is careful about

* **Money** is integer minor units (pesewas) in every column and payload, so Paystack amounts compare without conversion.
* **Soft deletes** everywhere: a Prisma client extension auto-scopes reads to non-deleted rows; `findUnique` is the deliberate "find deleted on purpose" seam (restore, idempotency). Unique contacts/references span tombstones.
* **Concurrency**: inventory is consumed *inside* transactions with guarded atomic `updateMany` (tour slots, flight seats) or a room-row lock + recount, so concurrent bookings can't oversell. Payment settlement is one transactional, idempotent step, so duplicate webhooks can't re-confirm or re-send receipts.
* **Dual principals**: staff (`User`, ADMIN/AGENT) and `Customer` are separate tables; tokens carry a `kind` claim, and contacts are unique *across* both tables so a signup can never shadow a staff login.
* **Auth**: refresh rotation with replay detection + session epochs, optional 2FA, passwordless OTP login, Google sign-in, verified email/phone changes, lockout, enumeration-safe 401s.
* **Notifications** (`src/notifications/`) ride a durable BullMQ queue: 3 attempts, exponential backoff, and exhausted jobs stay marked failed. `NOTIFICATIONS_INLINE=true` sends directly (tests, Redis-less local runs).

## Running

```bash
npm install            # runs prisma generate
cp .env.example .env   # every variable is documented there
npm run migrate        # prisma migrate dev
npm run seed           # default admin from ADMIN_* env vars
npm run dev            # tsx watch on server.ts (API + in-process workers)
```

Workers run inside the web process by default. For a dedicated worker process: set `WEB_DISABLE_WORKERS=true` on the web process and run `npm run worker:dev` (dev) or `npm run worker` (built).

| Script                     | What it does                                        |
| -------------------------- | --------------------------------------------------- |
| `npm run dev`              | API with watch + in-process workers                 |
| `npm run worker:dev`       | standalone worker with watch                        |
| `npm test`                 | integration suite (see below)                       |
| `npm run lint` / `type-check` / `build` | the CI gates                           |
| `npm run migrate` / `migrate:deploy:local` | dev migration / apply pending        |
| `npm run studio`           | Prisma Studio                                       |
| `npm run deploy`           | install → generate → migrate deploy → build (release) |

## Testing

`npm test` runs 350+ supertest tests against the real app and a dedicated Postgres database (`traveltrek_test`, derived from `DATABASE_URL`, auto-created/migrated in `test/global-setup.ts`, truncated between tests). All network egress is mocked (Paystack/axios, mail, SMS, Cloudinary); `NOTIFICATIONS_INLINE` keeps sends synchronous so no Redis is needed. Tests must not run concurrently (`fileParallelism: false`) because they share the DB.

## Health & observability

`/health` (liveness), `/health/ready` (DB verified once at boot, so it doesn't keep an auto-suspending DB awake), `/health/db` (on-demand deep check). Every request gets a correlation id (`x-request-id`) that threads through logs and error responses; unexpected errors go to Sentry when `SENTRY_DSN` is set.
