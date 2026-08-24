"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary for errors thrown in the root layout itself. It
 * replaces the whole document, so it renders its own <html>/<body> and can't
 * rely on the global stylesheet - everything is inline-styled and
 * self-contained, in the landing page's paper-and-ink palette.
 */
export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "64px 20px",
          background: "#e8edf5",
          color: "#1f2937",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <title>Something went wrong | Travel Trek</title>
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            background: "#ffffff",
            border: "1px solid rgba(31,41,55,0.2)",
            borderRadius: 14,
            overflow: "hidden",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              background: "#16233a",
              color: "#eef2f8",
              padding: "10px 20px",
              fontSize: 10,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            <span>Travel Trek</span>
            <span style={{ opacity: 0.7 }}>Status</span>
          </div>
          <div style={{ padding: "40px 28px" }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "#5b6b82",
              }}
            >
              Unexpected turbulence
            </p>
            <h1 style={{ margin: "12px 0 0", fontSize: 26 }}>
              Something went wrong.
            </h1>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 14,
                lineHeight: 1.6,
                color: "#5b6b82",
              }}
            >
              An unexpected error kept the app from loading. Try again. If it
              keeps happening, come back in a moment.
            </p>
            <div style={{ marginTop: 28 }}>
              {retry && (
                <button
                  onClick={() => retry()}
                  style={{
                    cursor: "pointer",
                    border: "none",
                    borderRadius: 9999,
                    background: "#1f2937",
                    color: "#ffffff",
                    padding: "10px 26px",
                    fontSize: 14,
                    fontWeight: 600,
                    marginRight: 10,
                  }}
                >
                  Try again
                </button>
              )}
              {/* Plain anchor on purpose: the app shell just crashed, so a
                  full-document navigation is the reliable way home. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                style={{
                  display: "inline-block",
                  borderRadius: 9999,
                  border: "1px solid rgba(31,41,55,0.3)",
                  color: "#1f2937",
                  padding: "9px 26px",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Back to home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
