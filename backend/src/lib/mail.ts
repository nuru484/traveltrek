// src/lib/mail.ts
//
// Outbound email over the Resend HTTP API (SMTP is blocked on several hosts,
// and an HTTP call fails fast instead of hanging a socket). Without
// RESEND_API_KEY the message is logged instead of sent, so auth flows stay
// fully exercisable in dev and CI without an account.
//
// This function THROWS on a delivery failure, deliberately. Two kinds of
// caller sit above it and they want opposite things:
//   - the notification queue retries the job and, after its attempts, keeps
//     the failure for inspection;
//   - the auth flows await the send and turn a failure into a 503, so nobody
//     is told "code sent" when nothing was sent.
// A caller that genuinely wants fire-and-forget goes through the notify
// client, which is where failures are swallowed and logged.
import { Resend } from 'resend';

import ENV from '#config/env.js';
import { renderTemplate } from '#mail/render-template.js';
import logger from '#utils/logger.js';

export interface SendMailParams {
  /** Template data; ignored unless `template` is set. */
  data?: Record<string, unknown>;
  /** Pre-rendered body, for a caller that isn't using a template. */
  html?: string;
  subject: string;
  /** EJS file under src/ejs, e.g. "message.ejs". */
  template?: string;
  /** Plain-text body. Always sent: some clients and gateways refuse HTML. */
  text: string;
  to: string;
}

const resend = ENV.RESEND_API_KEY ? new Resend(ENV.RESEND_API_KEY) : null;

const from = `${ENV.MAIL_FROM_NAME} <${ENV.MAIL_FROM_EMAIL}>`;

/** Sends a transactional email. Throws when the provider rejects it. */
export const sendMail = async (params: SendMailParams): Promise<void> => {
  const html =
    params.template && params.data
      ? await renderTemplate(params.template, params.data)
      : params.html;

  if (!resend) {
    logger.info(
      { subject: params.subject, text: params.text, to: params.to },
      'RESEND_API_KEY not set — email logged instead of sent',
    );
    return;
  }

  // Resend's request type demands a definite html or text body, so pick the
  // branch rather than passing an undefined field.
  const base = { from, subject: params.subject, to: params.to };
  const { error } = html
    ? await resend.emails.send({ ...base, html, text: params.text })
    : await resend.emails.send({ ...base, text: params.text });

  // Resend reports failures as a result value rather than a rejection; make
  // it a throw so every caller above sees delivery problems the same way.
  if (error) {
    throw new Error(`Resend send failed: ${error.name}: ${error.message}`);
  }
};
