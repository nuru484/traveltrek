import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Sensible baseline security headers for every response on this origin.
// No script-src CSP: the login page loads Google Identity Services from
// accounts.google.com, so a full CSP is deferred rather than half-enforced.
const securityHeaders = [
  // Clickjacking: this app is never meant to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Don't let browsers MIME-sniff responses into a different content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin (not the full path) on cross-origin navigations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS for two years, including subdomains.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Disable powerful browser features this app never uses.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

// The deployed commit, so Sentry events and uploaded source maps name the
// same release. Vercel sets VERCEL_GIT_COMMIT_SHA on every build; anywhere
// else the release is simply absent.
const sentryRelease =
  process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA;

const nextConfig: NextConfig = {
  // Don't advertise the framework in an x-powered-by header.
  poweredByHeader: false,
  // Inlined into every runtime bundle so src/lib/sentry-options.ts can read
  // it in the browser as well as on the server.
  env: sentryRelease ? { NEXT_PUBLIC_SENTRY_RELEASE: sentryRelease } : {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// Source maps upload only when the CI secrets exist; without them the
// Sentry plugin is a pass-through and the build never fails.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: sentryRelease },
  silent: !process.env.CI,
  // Browser events go through this same-origin route, so ad blockers that
  // drop requests to sentry.io do not drop the error reports.
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  webpack: { treeshake: { removeDebugLogging: true } },
});
