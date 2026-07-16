import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Proxy (formerly Middleware) — the first, cheap gate for the
 * dashboard. A visitor with no sign of a session is redirected to /login
 * before any dashboard bundle is sent.
 *
 * Two cookies count as "sign of a session":
 *  - `refreshToken` — the real httpOnly session cookie, visible here only when
 *    the API shares this site's domain (local dev, same-domain deploys).
 *  - `tt.auth.hint` — a first-party presence hint the client sets on login and
 *    clears on logout (see redux/auth/authSlice.ts), for production where the
 *    API lives on another origin and its cookies never reach this proxy.
 *
 * The gate is deliberately one-directional and presence-only. A *present*
 * cookie is NOT proof of a live session (it can be stale — e.g. a reset DB),
 * so we must NOT also redirect cookie-bearing visitors away from /login: that
 * would fight ProtectRoutes, the client-side second layer that owns the real
 * session check. Bouncing both ways on cookie presence loops, so /login is
 * left alone here.
 */
const SESSION_COOKIE = "refreshToken";
const HINT_COOKIE = "tt.auth.hint";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasSessionSign =
    request.cookies.has(SESSION_COOKIE) || request.cookies.has(HINT_COOKIE);

  if (pathname.startsWith("/dashboard") && !hasSessionSign) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
