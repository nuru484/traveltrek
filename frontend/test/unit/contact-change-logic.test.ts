// test/unit/contact-change-logic.test.ts
//
// Payload shapes for the secure contact-change flows: exactly ONE re-auth
// proof (currentPassword | code), mirroring the backend's exactly-one rule.
import { describe, expect, it } from "vitest";
import {
  buildChangeEmailPayload,
  buildChangePhonePayload,
  isValidReauthCode,
} from "@/components/settings/contact-change-logic";
import {
  changeEmailFormSchema,
  changePhoneFormSchema,
} from "@/validation/auth-validation";

describe("contact-change payloads", () => {
  it("password re-auth sends currentPassword and NO code", () => {
    expect(
      buildChangeEmailPayload("new@example.com", "password", "secret-pass")
    ).toEqual({ newEmail: "new@example.com", currentPassword: "secret-pass" });
    expect(
      buildChangePhonePayload("+233540000000", "password", "secret-pass")
    ).toEqual({ newPhone: "+233540000000", currentPassword: "secret-pass" });
  });

  it("code re-auth sends code and NO currentPassword", () => {
    expect(
      buildChangeEmailPayload("new@example.com", "code", "123456")
    ).toEqual({ newEmail: "new@example.com", code: "123456" });
    expect(buildChangePhonePayload("+233540000000", "code", "123456")).toEqual(
      { newPhone: "+233540000000", code: "123456" }
    );
  });

  it("validates the 6-digit reauth code shape", () => {
    expect(isValidReauthCode("123456")).toBe(true);
    expect(isValidReauthCode("12345")).toBe(false);
    expect(isValidReauthCode("12345a")).toBe(false);
    expect(isValidReauthCode("")).toBe(false);
  });
});

describe("contact-change form schemas", () => {
  it("password method requires a non-empty secret", () => {
    expect(
      changeEmailFormSchema.safeParse({
        newEmail: "new@example.com",
        method: "password",
        secret: "",
      }).success
    ).toBe(false);
    expect(
      changeEmailFormSchema.safeParse({
        newEmail: "new@example.com",
        method: "password",
        secret: "pw",
      }).success
    ).toBe(true);
  });

  it("code method requires exactly 6 digits", () => {
    expect(
      changePhoneFormSchema.safeParse({
        newPhone: "+233540000000",
        method: "code",
        secret: "12345",
      }).success
    ).toBe(false);
    expect(
      changePhoneFormSchema.safeParse({
        newPhone: "+233540000000",
        method: "code",
        secret: "123456",
      }).success
    ).toBe(true);
  });

  it("rejects an invalid new email / phone", () => {
    expect(
      changeEmailFormSchema.safeParse({
        newEmail: "not-an-email",
        method: "password",
        secret: "pw",
      }).success
    ).toBe(false);
    expect(
      changePhoneFormSchema.safeParse({
        newPhone: "123",
        method: "password",
        secret: "pw",
      }).success
    ).toBe(false);
  });
});
