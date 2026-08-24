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

`npm run deploy` is `npm ci --include=dev && npm run build && npm run bootstrap`.

Two things about that command are load-bearing:

- **`--include=dev` is not optional.** Render sets `NODE_ENV=production`, under
  which `npm ci` skips devDependencies. The `postinstall` hook then runs
  `prisma generate`, which loads `prisma.config.ts`, which resolves
  `tsconfig.json`, which extends `@tsconfig/node22` - a devDependency. Without
  the flag the build dies with ``File '@tsconfig/node22/tsconfig.json' not
  found``. `tsc` is a devDependency too, so the build step would fail next
  regardless. Only the build needs them; `npm start` runs `node dist/server.js`.
- **It does not run migrations.** They belong in the workflow, before the new
  code ships - see below.

## Secrets

| Secret | Required | What it is |
| --- | --- | --- |
| `RENDER_DEPLOY_HOOK_URL` | yes | Settings -> Deploy Hook. Holding it is enough to trigger a deploy, so treat it as a credential. |
| `PRODUCTION_DATABASE_URL` | strongly | The production connection string. Without it the workflow warns and deploys **without migrating**. |
| `RENDER_API_KEY` | optional | Account Settings -> API Keys. Lets the workflow wait for the build instead of firing and forgetting. |
| `RENDER_SERVICE_ID` | optional | The `srv-…` id in the service URL. Needed with the API key. |
| `RENDER_HEALTH_URL` | optional | e.g. `https://api.elektorpro.manuru.dev/health/ready`. The post-deploy readiness gate. |

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

# Generate each with: openssl rand -base64 48
# All three must be at least 32 characters; the API refuses to boot otherwise.
ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=
# Separate from the token secrets on purpose: sharing them meant rotating
# ACCESS_TOKEN_SECRET silently made every stored TOTP secret undecryptable.
ENCRYPTION_KEY=

# The client's origin. Without it every browser request fails CORS.
CORS_ACCESS=https://vote.example.org
FRONTEND_URL=https://vote.example.org

# NOT optional in practice. Without Redis the background queues are disabled,
# which means elections DO NOT auto-open or auto-close on schedule, expired
# sessions and OTPs are never swept, rate limits reset on every restart, and a
# second instance would silently stop receiving live results.
REDIS_URL=redis://...

OTP_MODE=live
FROG_API_KEY=
FROG_SENDER_ID=
FROG_USERNAME=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

RESEND_API_KEY=
MAIL_FROM="TravelTrek <no-reply@manuru.dev>"

SENTRY_DSN=

ADMIN_EMAIL=admin@example.org
ADMIN_FIRST_NAME=Super
ADMIN_LAST_NAME=Admin
ADMIN_PHONE=+233200000001
ORGANIZATION_NAME=Your Organization
```

`REDIS_URL` deserves its own note: without it the background queues are
disabled, which means elections do **not** auto-open or auto-close on schedule,
expired sessions and OTPs are never swept, rate limits reset on every restart,
and a second instance would silently stop receiving live results.

## Deploying during an election

Don't, if you can avoid it. A release drops in-flight requests and every open
websocket, and voters mid-ballot see an error.

If you must:

- Use the `production` environment's approval gate (Settings -> Environments ->
  `production` -> required reviewers) so it cannot happen by accident.
- The app closes HTTP, realtime, workers and the pool in order on `SIGTERM`
  with its own 35s cap, so a restart drains in-flight ballots rather than being
  killed mid-transaction.
- Prefer a window when no election is `IN_PROGRESS`.
  `GET /api/v1/elections?status=IN_PROGRESS` answers that in one call.

## Deploying the client

The Next.js client is **not** shipped by this workflow. Point a Vercel project
at this repository with root directory `client`, set `NEXT_PUBLIC_API_URL` to
the API's public URL, and it deploys on every push with preview URLs per pull
request.

`NEXT_PUBLIC_API_URL` is baked in **at build time** and also lands in the CSP's
`connect-src`, so changing the API's hostname requires a rebuild, not just an
environment change.
