// test/validation/auth-validation.test.ts
//
// The signup schema's core contract: a name plus ONE contact channel
// (email or phone), password optional. Mirrors the backend rules.
import { describe, expect, it } from "vitest";
import {
  contactToPayload,
  otpRequestFormSchema,
  otpVerifyFormSchema,
  signupFormSchema,
} from "@/validation/auth-validation";

describe("signupFormSchema", () => {
  const base = { name: "Amina Fuseini", email: "", phone: "", password: "" };

  it("accepts email as the contact channel", () => {
    const result = signupFormSchema.safeParse({
      ...base,
      contactMethod: "email",
      email: "amina@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts phone as the contact channel", () => {
    const result = signupFormSchema.safeParse({
      ...base,
      contactMethod: "phone",
      phone: "+233540000000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when the chosen channel is empty", () => {
    const result = signupFormSchema.safeParse({
      ...base,
      contactMethod: "email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Provide an email or a phone number"
      );
    }
  });

  it("requires the phone channel to hold a phone when selected", () => {
    // Email filled but phone chosen and empty: the refinement still fails.
    const result = signupFormSchema.safeParse({
      ...base,
      contactMethod: "phone",
      email: "amina@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("keeps password optional but enforces its bounds when present", () => {
    const withoutPassword = signupFormSchema.safeParse({
      ...base,
      contactMethod: "email",
      email: "amina@example.com",
      password: "",
    });
    expect(withoutPassword.success).toBe(true);

    const tooShort = signupFormSchema.safeParse({
      ...base,
      contactMethod: "email",
      email: "amina@example.com",
      password: "abc",
    });
    expect(tooShort.success).toBe(false);
  });
});

describe("OTP schemas", () => {
  it("accepts an email or a phone as the contact", () => {
    expect(
      otpRequestFormSchema.safeParse({ contact: "amina@example.com" }).success
    ).toBe(true);
    expect(
      otpRequestFormSchema.safeParse({ contact: "+233540000000" }).success
    ).toBe(true);
    expect(otpRequestFormSchema.safeParse({ contact: "nope" }).success).toBe(
      false
    );
  });

  it("requires a 6-digit code", () => {
    expect(otpVerifyFormSchema.safeParse({ code: "123456" }).success).toBe(
      true
    );
    expect(otpVerifyFormSchema.safeParse({ code: "12345" }).success).toBe(
      false
    );
    expect(otpVerifyFormSchema.safeParse({ code: "12345a" }).success).toBe(
      false
    );
  });

  it("splits a contact into the backend's email|phone pair", () => {
    expect(contactToPayload("amina@example.com")).toEqual({
      email: "amina@example.com",
    });
    expect(contactToPayload("+233540000000")).toEqual({
      phone: "+233540000000",
    });
  });
});
