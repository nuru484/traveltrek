// test/validation/customer-validation.test.ts
//
// Customer create: name + at least one contact. NO password on either
// surface — staff never set a customer's password (the backend strips a
// `password` key); owners manage it via Settings → Password.
import { describe, expect, it } from "vitest";
import {
  customerCreateFormSchema,
  customerUpdateFormSchema,
} from "@/validation/customer-validation";

const base = {
  name: "Fuseini Mohammed",
  email: "fuseini@example.com",
  phone: "",
  address: "",
};

describe("customerCreateFormSchema", () => {
  it("accepts a minimal customer (accounts start passwordless)", () => {
    expect(customerCreateFormSchema.safeParse(base).success).toBe(true);
  });

  it("has no password field — a stray key is stripped, not validated", () => {
    const result = customerCreateFormSchema.safeParse({
      ...base,
      password: "abc",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("password" in result.data).toBe(false);
    }
  });

  it("requires at least one contact channel", () => {
    const result = customerCreateFormSchema.safeParse({
      ...base,
      email: "",
      phone: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Provide an email or a phone number"
      );
    }
  });

  it("accepts phone as the only contact", () => {
    expect(
      customerCreateFormSchema.safeParse({
        ...base,
        email: "",
        phone: "+233540000000",
      }).success
    ).toBe(true);
  });
});

describe("customerUpdateFormSchema", () => {
  it("does not require any contact channel", () => {
    expect(
      customerUpdateFormSchema.safeParse({ ...base, email: "", phone: "" })
        .success
    ).toBe(true);
  });

  it("has no password field — a stray key is stripped, not validated", () => {
    const result = customerUpdateFormSchema.safeParse({
      ...base,
      password: "abc",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("password" in result.data).toBe(false);
    }
  });
});
