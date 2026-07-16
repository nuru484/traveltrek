// test/unit/login-redirect-logic.test.ts
//
// The post-login redirect honors the proxy's ?from=... only for in-app
// dashboard paths — anything else falls back to /dashboard.
import { describe, expect, it } from "vitest";
import { loginRedirectPath } from "@/components/authentication/login-redirect-logic";

describe("loginRedirectPath", () => {
  it("returns /dashboard when there is no from param", () => {
    expect(loginRedirectPath("")).toBe("/dashboard");
    expect(loginRedirectPath("?tab=otp")).toBe("/dashboard");
  });

  it("honors dashboard paths from the proxy", () => {
    expect(loginRedirectPath("?from=%2Fdashboard%2Fbookings")).toBe(
      "/dashboard/bookings"
    );
    expect(loginRedirectPath("?from=/dashboard")).toBe("/dashboard");
  });

  it("refuses off-site and non-dashboard targets", () => {
    expect(loginRedirectPath("?from=https%3A%2F%2Fevil.example")).toBe(
      "/dashboard"
    );
    expect(loginRedirectPath("?from=//evil.example/dashboard")).toBe(
      "/dashboard"
    );
    expect(loginRedirectPath("?from=/admin")).toBe("/dashboard");
    expect(loginRedirectPath("?from=/dashboardevil")).toBe("/dashboard");
  });
});
