// src/lib/mail.ts
//
// Default mail transport for the `mail` dep in AppDeps. When SMTP_HOST is
// configured, messages go out over nodemailer; otherwise (local dev, CI) the
// "transport" just logs the message so auth flows remain fully exercisable
// without an SMTP account. Never throws — callers fire-and-forget, and a
// delivery failure must never fail (or time) the request that triggered it.
import { setDefaultResultOrder } from 'node:dns';
import nodemailer, { type Transporter } from 'nodemailer';

import ENV from '#config/env.js';
import logger from '#utils/logger.js';

// Prefer IPv4 when DNS returns both families. Node otherwise dials the IPv6
// address first, which dead-ends (connect ENETUNREACH) on hosts without an
// IPv6 route — WSL2 dev boxes most notably — before IPv4 is ever tried.
// Process-wide by nature, and harmless where IPv6 genuinely works.
setDefaultResultOrder('ipv4first');

export interface SendMailParams {
  html?: string;
  subject: string;
  text: string;
  to: string;
}

const transporter: null | Transporter = ENV.SMTP_HOST
  ? nodemailer.createTransport({
      auth: ENV.SMTP_USER
        ? { pass: ENV.SMTP_PASSWORD, user: ENV.SMTP_USER }
        : undefined,
      // Fail fast instead of hanging: with a single pooled connection, one
      // stalled socket would otherwise block every queued message.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      host: ENV.SMTP_HOST,
      maxConnections: 1,
      pool: true,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_SECURE,
      socketTimeout: 20_000,
    })
  : null;

/** Sends a transactional email (or logs it when SMTP is not configured). */
export const sendMail = async (params: SendMailParams): Promise<void> => {
  if (!transporter) {
    logger.info(
      { subject: params.subject, text: params.text, to: params.to },
      'SMTP not configured — email logged instead of sent',
    );
    return;
  }
  try {
    await transporter.sendMail({
      from: `${ENV.MAIL_FROM_NAME} <${ENV.MAIL_FROM_EMAIL}>`,
      html: params.html,
      subject: params.subject,
      text: params.text,
      to: params.to,
    });
  } catch (error) {
    logger.error(
      { err: error, subject: params.subject, to: params.to },
      'Failed to send email',
    );
  }
};
