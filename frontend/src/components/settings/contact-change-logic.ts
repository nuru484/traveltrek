// src/components/settings/contact-change-logic.ts
//
// Pure payload builders for the secure contact-change dialogs. The backend
// (backend/src/validations/auth-validation.ts changeEmailSchema /
// changePhoneSchema) requires exactly ONE re-auth proof: currentPassword for
// accounts with a password, or the 6-digit code POST /auth/reauth/challenge
// sent for passwordless accounts — never both.
import type { IChangeEmailInput, IChangePhoneInput } from "@/types/auth";

/** How the user proves it's them: their password or an emailed/texted code. */
export type ReauthMethod = "password" | "code";

/** Exactly-one-proof payload for POST /auth/change-email. */
export function buildChangeEmailPayload(
  newEmail: string,
  method: ReauthMethod,
  secret: string
): IChangeEmailInput {
  return method === "password"
    ? { newEmail, currentPassword: secret }
    : { newEmail, code: secret };
}

/** Exactly-one-proof payload for POST /auth/change-phone. */
export function buildChangePhonePayload(
  newPhone: string,
  method: ReauthMethod,
  secret: string
): IChangePhoneInput {
  return method === "password"
    ? { newPhone, currentPassword: secret }
    : { newPhone, code: secret };
}

/** Mirrors the backend codeField: exactly 6 digits. */
export function isValidReauthCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
