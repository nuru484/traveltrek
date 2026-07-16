// src/components/authentication/login-redirect-logic.ts
//
// Consumes the `?from=...` that src/proxy.ts appends when it bounces a
// logged-out visitor off a dashboard URL. Only in-app dashboard paths are
// honored, so the post-login redirect can never be aimed off-site.
export function loginRedirectPath(search: string): string {
  const from = new URLSearchParams(search).get("from");
  if (from && /^\/dashboard(\/|$)/.test(from)) {
    return from;
  }
  return "/dashboard";
}
