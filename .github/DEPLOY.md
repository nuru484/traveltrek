# Production deploy

The API runs on **Render**; the Next.js client is hosted separately (see the end
of this file). `render-deploy.yml` is the only thing that may deploy: it runs
after CI passes on `main`, applies database migrations, then asks Render to
build and release that exact commit.


## The problem: Render auto-deploys from `main`

Render watches the connected branch and starts building the moment a commit
lands. That is before CI has run, and it happens whether CI passes or fails, so
on its own it gives you:

- a red test suite deployed to production anyway, and
- new code meeting an un-migrated database, because nothing ran the migration.

Render has no "wait for checks" setting. The fix is to take the trigger away
from Render and give it to CI:

**In the Render dashboard: Settings -> Build & Deploy -> Auto-Deploy: `No`.**

From then on the service only builds when something POSTs its deploy hook, and
the only thing that does is this workflow, after CI passes. The pipeline becomes:

```
push to main
  -> CI            lint, type-check, build, tests on real Postgres (server + client)
  -> migrations    prisma migrate deploy against the production database
  -> deploy hook   Render builds and releases the CI-validated commit
  -> health check  GET /health/ready until the new release answers
```

If CI fails, no hook is fired and production keeps running the previous release.

## Render service settings

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Build command | `npm run deploy` |
| Start command | `npm start` |
| Auto-Deploy | **No** (this is the important one) |
| Health check path | `/health/ready` |

`npm run deploy` is `npm ci --include=dev && npm run build`.

Two things about that command are load-bearing:

- **`--include=dev` is not optional.** Render sets `NODE_ENV=production`, under
  which `npm ci` skips devDependencies, and the build needs three of them:
  `typescript` (`tsc`), `tsc-alias` (rewrites the `#` import aliases in the
  compiled output) and `tsx` (the OpenAPI check and the seed/bootstrap
  scripts). Only the build needs them; `npm start` runs `node build/server.js`.
- **It does not run migrations or create the admin.** Both belong in the
  workflow, before the new code ships - see below.

Node is pinned in the repository's `.nvmrc`; CI, the deploy workflow and the
Dockerfile all track the same major, so set the service's `NODE_VERSION` to
match when Render's default drifts from it.

Render sets `RENDER_GIT_COMMIT` on every deploy, and the API uses it as the
Sentry `release` unless `SENTRY_RELEASE` is set explicitly, so no release
variable needs configuring for events to name their commit.

## Secrets

| Secret | Required | What it is |
| --- | --- | --- |
| `RENDER_DEPLOY_HOOK_URL` | yes | Settings -> Deploy Hook. Holding it is enough to trigger a deploy, so treat it as a credential. |
| `PRODUCTION_DATABASE_URL` | strongly | The production connection string. Without it the workflow warns and deploys **without migrating**. |
| `RENDER_API_KEY` | optional | Account Settings -> API Keys. Lets the workflow wait for the build instead of firing and forgetting. |
| `RENDER_SERVICE_ID` | optional | The `srv-…` id in the service URL. Needed with the API key. |
| `RENDER_HEALTH_URL` | optional | e.g. `https://api.example.com/health/ready`. The post-deploy readiness gate. |
| `ADMIN_BOOTSTRAP_ENABLED` / `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PHONE` | once | The first-admin bootstrap step. `ADMIN_BOOTSTRAP_ENABLED=true` for the single deploy that should create it, then remove it (see the README). |

**Until `RENDER_DEPLOY_HOOK_URL` exists the job skips with a notice rather than
failing**, so merging the workflow changes nothing until you opt in.

## Why migrations run in the workflow, not on Render

Render offers a pre-deploy command, but running migrations from the workflow is
better here for three reasons:

- the Prisma CLI is a devDependency and the migration output lands in the
  workflow log, where you can read what was applied;
- the production database URL lives in one place, GitHub secrets;
- `concurrency: render-production` means two merges queue instead of running
  migrations against the same database at once.

**Ordering.** Migrations run *before* Render builds the new code, so for the
couple of minutes the build takes the **old** release is talking to the **new**
schema. That is safe as long as every migration is additive. A migration that
drops or renames something the running code still reads must be split across two
deploys: ship the code that stops using the column, then ship the migration that
removes it.

Migrations are never rolled back. If one is wrong, write a forward fix.

## Rollback

Render keeps previous builds: **Deploys -> pick an earlier deploy -> Redeploy**.
That reverts code only, never the database, which is the other reason migrations
have to be backward compatible.

## Manual deploy

`Actions -> Deploy API to Render -> Run workflow` deploys the current `main`
without waiting for a push. The deploy hook always builds the branch head, so to
release an older commit, roll back from the Render dashboard instead.

## Environment variables

Set these in the Render dashboard (Environment -> Environment Variables). The
API fails fast at boot on anything required and missing, and the workflow's
configuration check warns about the optional ones that matter in production.

```bash
DATABASE_URL=postgresql://...
DB_POOL_MAX=20
REDIS_URL=redis://...

# Generate each with: openssl rand -base64 48
ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=
ACCESS_TOKEN_EXPIRY=30m
REFRESH_TOKEN_EXPIRY=7d
COOKIE_DOMAIN=

# The client's origin. Without it every browser request fails CORS.
CORS_ACCESS=https://app.example.com
FRONTEND_URL=https://app.example.com

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

PAYSTACK_SECRET_KEY=
PAYSTACK_CALLBACK_URL=https://app.example.com/dashboard/payments/callback

RESEND_API_KEY=
MAIL_FROM_NAME=TravelTrek
MAIL_FROM_EMAIL=no-reply@example.com
EMAIL_LOGO_URL=https://app.example.com/logo.png

# Optional: unset logs SMS instead of sending.
FROG_API_KEY=
FROG_USERNAME=
FROG_SENDER_ID=

# Optional: unset disables Google sign-in (503).
GOOGLE_CLIENT_ID=

# Optional: unset disables error tracking. Release comes from RENDER_GIT_COMMIT.
SENTRY_DSN=
SENTRY_ENVIRONMENT=production

# Optional: one of fatal, error, warn, info, debug, trace (default info).
LOG_LEVEL=info

# Only when a dedicated worker process runs build/worker.js.
WEB_DISABLE_WORKERS=false
```

`REDIS_URL` deserves its own note: the API refuses to boot without it, because
BullMQ carries the booking-deadline sweep, flight and tour status updates,
payment reconciliation and every customer email/SMS, and the rate limiter and
session cache live there too.

## Deploying while customers are mid-checkout

A release drops in-flight requests. The app closes HTTP, then the BullMQ
workers (waiting for in-flight jobs), then Redis and the database pool on
`SIGTERM`, with its own 35s cap before it forces exit, so a restart drains a
payment callback rather than being killed mid-transaction. Anything a lost
webhook leaves behind is picked up by the payment reconciliation job on its
next tick. Prefer a quiet window all the same, and use the `production`
environment's approval gate (Settings -> Environments -> `production` ->
required reviewers) when a deploy must not happen by accident.

## Deploying the client

The Next.js client is **not** shipped by this workflow. Point a Vercel project
at this repository with root directory `frontend`, set `NEXT_PUBLIC_SERVER_URI`
to the API's public URL (and the other variables in `frontend/.env.example`),
and it deploys on every push with preview URLs per pull request.

`NEXT_PUBLIC_*` values are baked in **at build time**, so changing the API's
hostname requires a redeploy, not just an environment change. Vercel sets
`VERCEL_GIT_COMMIT_SHA` on every build and the client uses it as the Sentry
release; source maps upload only when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and
`SENTRY_PROJECT` are set.

## The Dockerfile

`backend/Dockerfile` is not what Render runs (it builds from source with the
commands above); it exists for self-hosting. CI's `docker-build` job builds it
on every push without pushing an image, so it cannot rot unnoticed.
