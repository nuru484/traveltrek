// Options shared by every Sentry runtime init (browser, Node.js, edge), so
// the three entry files cannot drift from each other.
import type { BrowserOptions, NodeOptions } from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Inlined at build time from VERCEL_GIT_COMMIT_SHA (see next.config.ts), so
// an event names the exact deploy it came from. Empty outside Vercel.
const release = process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined;

export const sentryOptions: BrowserOptions & NodeOptions = {
  dsn,
  // Without a DSN the SDK is inert, so local dev, CI and tests need no account.
  enabled: Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV,
  release,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  sendDefaultPii: false,
};
