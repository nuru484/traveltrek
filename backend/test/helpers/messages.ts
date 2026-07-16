// test/helpers/messages.ts
//
// Reads what the auth flows "sent": test/setup.ts mocks the mail and SMS
// libs, so OTP codes and reset tokens can be pulled straight out of the
// recorded message content instead of hitting SMTP/Frog or brute-forcing
// hashes.
import { vi } from 'vitest';

import { sendMail, type SendMailParams } from '#lib/mail.js';
import { sendSms, type SendSmsParams } from '#lib/sms.js';

export const sentEmails = (): SendMailParams[] =>
  vi.mocked(sendMail).mock.calls.map((call) => call[0]);

export const sentSms = (): SendSmsParams[] =>
  vi.mocked(sendSms).mock.calls.map((call) => call[0]);

export const lastEmailTo = (to: string): SendMailParams | undefined =>
  sentEmails()
    .filter((params) => params.to === to)
    .at(-1);

export const lastSmsTo = (to: string): SendSmsParams | undefined =>
  sentSms()
    .filter((params) => params.to === to)
    .at(-1);

const extractOtp = (text: string | undefined, recipient: string): string => {
  const match = /\b(\d{6})\b/.exec(text ?? '');
  if (!match?.[1]) throw new Error(`No OTP code in message to ${recipient}`);
  return match[1];
};

/** Extracts the 6-digit OTP from the most recent email to `to`. */
export const otpFromEmail = (to: string): string =>
  extractOtp(lastEmailTo(to)?.text, to);

/** Extracts the 6-digit OTP from the most recent SMS to `to`. */
export const otpFromSms = (to: string): string =>
  extractOtp(lastSmsTo(to)?.message, to);

/** Extracts the password-reset token from the most recent email to `to`. */
export const resetTokenFromEmail = (to: string): string => {
  const match = /token=([a-f0-9]{64})/.exec(lastEmailTo(to)?.text ?? '');
  if (!match?.[1]) throw new Error(`No reset token in email to ${to}`);
  return match[1];
};

/** Drops recorded messages so a test starts from a clean outbox. */
export const clearMessages = (): void => {
  vi.mocked(sendMail).mockClear();
  vi.mocked(sendSms).mockClear();
};
