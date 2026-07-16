# TravelTrek Frontend

Next.js (App Router) + React 19 + TypeScript (strict) client for the TravelTrek booking platform. RTK Query for data, react-hook-form + Zod for forms, shadcn/ui on Tailwind v4, light/dark via next-themes.

## Route map

* **Public** — `/` (the portfolio landing, fully static), `/demo` (the live showcase: real inventory from the backend's public API, 5-minute ISR, degrades gracefully to a "demo idle" board when the backend sleeps), plus `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/confirm-email-change`. SEO plumbing: sitemap, robots, manifest, per-page OpenGraph images.
* **Dashboard** — one surface at `/dashboard/*` shared by customers, agents, and admins via role-aware rendering (nav, reports, reviews, and stats all swap by role). Consistent per-entity pattern: list → `[id]/detail` → `[id]/edit` → `create`, for bookings, customers, destinations, flights, hotels (+ rooms), tours, payments (+ Paystack callback), reviews, reports, users, and settings (password / verified contact change / two-factor).
* **Gate** — `src/proxy.ts` does a presence-only cookie check and redirects to `/login?from=…`; `ProtectRoutes` re-checks client-side. `login-redirect-logic` only honours in-app `/dashboard` targets (no open redirects).

## Data layer

* RTK Query slices in `src/redux/` (one per domain + `authApi`), all speaking the backend's `{ message, data, meta? }` envelope, with centralized cache tags in `src/types/api.ts`.
* Auth is **httpOnly-cookie only** — no tokens in JS. `baseQueryWithReauth` deduplicates concurrent refreshes behind a mutex, retries once, and knows which 401 codes are credential failures that must *not* be retried (so a wrong password can't double-count toward lockout).
* Forms send multipart `FormData` where photos are involved; sending a photo field as an **empty string** is the API's remove-photo signal (see `src/utils/photo-removal.ts`).

## UI conventions

* **Phones first**: tables render as tappable row-card lists below `md` and real tables above (`src/components/ui/table-bits.tsx`).
* **Table state lives in the URL** (`useTableQueryState`): page, size, and filters are shareable and restored when navigating back.
* **Dashboards are per-widget**: each stat/chart owns its skeleton, error, and retry — one failed query never blanks the page.
* Money renders from integer pesewas via `formatMoney`; worst-case content (long names, emails) is part of the design, not an afterthought.
* Logic that can be pure lives in `*-logic.ts` modules next to the component, unit-tested without rendering.

## Environment

| Variable                        | Purpose                                              |
| ------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SERVER_URI`        | API base URL (unset degrades the live demo board)    |
| `NEXT_PUBLIC_BASE_URL`          | canonical site URL for metadata/sitemap              |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`  | shows the Google sign-in button when set             |
| `NEXT_PUBLIC_DEMO_*`            | demo-account quick logins on `/login` (portfolio)    |

## Running

```bash
npm install
cp .env.example .env
npm run dev          # :3000 (Turbopack)
```

`npm test` runs 200+ vitest unit/component tests (jsdom, no server needed); `npm run lint`, `type-check`, and `build` are the CI gates.
