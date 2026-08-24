// src/mail/auth-emails.ts
//
// Builders for the emails a person is standing on: sign-in codes, reset links,
// contact confirmations. Each returns the send params minus the recipient, so
// the auth services add `to` and hand the whole thing to the mail client -
// which keeps the copy in one place and the services assertable in tests.
//
// Every builder ships a plain-text `text` alongside the template data: clients
// that refuse HTML, and gateways that strip it, still get the code or link.
import type { SendMailParams } from '#lib/mail.js';

type AuthEmail = Omit<SendMailParams, 'to'>;

const TEMPLATE = 'message.ejs';

const BRAND_NAME = 'TravelTrek';

const IGNORE_NOTE = "Didn't request this? You can ignore this email.";

/** Passwordless login code for a customer. */
export const buildOtpLoginEmail = (
  name: string,
  code: string,
  ttlMinutes: number,
): AuthEmail => ({
  data: {
    code,
    codeNote: `Expires in ${String(ttlMinutes)} minutes.`,
    intro: ['Use this code to finish signing in.'],
    name,
    note: IGNORE_NOTE,
    preview: `Your login code expires in ${String(ttlMinutes)} minutes.`,
    title: 'Your login code',
  },
  subject: `Your ${BRAND_NAME} login code`,
  template: TEMPLATE,
  text:
    `Hi ${name},\n\n` +
    `Your ${BRAND_NAME} login code is ${code}. It expires in ${String(ttlMinutes)} minutes.\n\n` +
    IGNORE_NOTE,
});

/** Second-factor code at sign-in. */
export const buildTwoFactorEmail = (
  name: string,
  code: string,
  ttlMinutes: number,
): AuthEmail => ({
  data: {
    code,
    codeNote: `Expires in ${String(ttlMinutes)} minutes.`,
    intro: ['Use this code to complete your sign-in.'],
    name,
    note: IGNORE_NOTE,
    preview: `Your verification code expires in ${String(ttlMinutes)} minutes.`,
    title: 'Your verification code',
  },
  subject: `Your ${BRAND_NAME} verification code`,
  template: TEMPLATE,
  text:
    `Hi ${name},\n\n` +
    `Your ${BRAND_NAME} verification code is ${code}. It expires in ${String(ttlMinutes)} minutes.\n\n` +
    IGNORE_NOTE,
});

/** Password-reset link. */
export const buildPasswordResetEmail = (
  name: string,
  resetUrl: string,
  ttlMinutes: number,
): AuthEmail => ({
  data: {
    action: { label: 'Reset password', url: resetUrl },
    intro: [
      `Set a new password using the button below. The link works for ${String(ttlMinutes)} minutes.`,
    ],
    name,
    note: "Didn't request this? Your password stays as it is.",
    preview: `Reset your password within ${String(ttlMinutes)} minutes.`,
    title: 'Reset your password',
  },
  subject: `Reset your ${BRAND_NAME} password`,
  template: TEMPLATE,
  text:
    `Hi ${name},\n\n` +
    'We received a request to reset your password. ' +
    `Use the link below within ${String(ttlMinutes)} minutes:\n\n` +
    `${resetUrl}\n\n` +
    "If you didn't request this, you can ignore this email.",
});

/** Confirmation of a new email address, sent to the new address. */
export const buildEmailChangeEmail = (
  name: string,
  newEmail: string,
  confirmUrl: string,
  ttlMinutes: number,
): AuthEmail => ({
  data: {
    action: { label: 'Confirm email address', url: confirmUrl },
    intro: [
      `Confirm ${newEmail} as the new address on your account. The link works for ${String(ttlMinutes)} minutes.`,
    ],
    name,
    note: 'Until you confirm, your account keeps its current email.',
    preview: `Confirm ${newEmail} on your ${BRAND_NAME} account.`,
    title: 'Confirm your new email address',
  },
  subject: `Confirm your new ${BRAND_NAME} email address`,
  template: TEMPLATE,
  text:
    `Hi ${name},\n\n` +
    `Use the link below within ${String(ttlMinutes)} minutes to confirm ${newEmail} as the new email address for your ${BRAND_NAME} account:\n\n` +
    `${confirmUrl}\n\n` +
    'Until you confirm, your account keeps its current email. ' +
    "If you didn't request this change, you can ignore this message.",
});
