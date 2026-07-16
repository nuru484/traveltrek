// test/unit/roles.test.ts
//
// Role gating for the split-principal auth model: staff carry ADMIN | AGENT,
// customer sessions have no role field at all.
import { describe, expect, it } from "vitest";
import { isAdmin, isAgent, isCustomer, isStaff, roleOf } from "@/utils/roles";
import type { IAuthUser } from "@/types/auth";

const staff = (role: "ADMIN" | "AGENT") =>
  ({ id: 1, name: "Staff", role } as unknown as IAuthUser);

const customer = { id: 2, name: "Customer" } as unknown as IAuthUser;

describe("roles", () => {
  it("recognizes ADMIN", () => {
    expect(isAdmin(staff("ADMIN"))).toBe(true);
    expect(isAdmin(staff("AGENT"))).toBe(false);
    expect(isAdmin(customer)).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it("recognizes AGENT", () => {
    expect(isAgent(staff("AGENT"))).toBe(true);
    expect(isAgent(staff("ADMIN"))).toBe(false);
    expect(isAgent(customer)).toBe(false);
  });

  it("isStaff means ADMIN or AGENT", () => {
    expect(isStaff(staff("ADMIN"))).toBe(true);
    expect(isStaff(staff("AGENT"))).toBe(true);
    expect(isStaff(customer)).toBe(false);
    expect(isStaff(null)).toBe(false);
  });

  it("a logged-in principal without a staff role is a customer", () => {
    expect(isCustomer(customer)).toBe(true);
    expect(isCustomer(staff("ADMIN"))).toBe(false);
    // Nobody logged in is not a customer either.
    expect(isCustomer(null)).toBe(false);
    expect(isCustomer(undefined)).toBe(false);
  });

  it("roleOf reads a missing role as CUSTOMER", () => {
    expect(roleOf(staff("ADMIN"))).toBe("ADMIN");
    expect(roleOf(staff("AGENT"))).toBe("AGENT");
    expect(roleOf(customer)).toBe("CUSTOMER");
    expect(roleOf(null)).toBe("CUSTOMER");
  });
});
