// test/validation/customer-validation.test.ts
//
// Customer create: name + at least one contact; set-password is OPTIONAL in
// both modes (blank means "passwordless" / "keep current password").
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
  password: "",
};

describe("customerCreateFormSchema", () => {
  it("accepts a customer with a blank password (passwordless)", () => {
    expect(customerCreateFormSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a password of 4+ characters when set", () => {
    expect(
      customerCreateFormSchema.safeParse({ ...base, password: "s3cret" })
        .success
    ).toBe(true);
  });

  it("rejects a too-short password when one is provided", () => {
    const result = customerCreateFormSchema.safeParse({
      ...base,
      password: "abc",
    });
    expect(result.success).toBe(false);
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

  it("still keeps password optional with bounds", () => {
    expect(
      customerUpdateFormSchema.safeParse({ ...base, password: "" }).success
    ).toBe(true);
    expect(
      customerUpdateFormSchema.safeParse({ ...base, password: "abc" }).success
    ).toBe(false);
  });
});
