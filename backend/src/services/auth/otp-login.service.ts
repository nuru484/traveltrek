// src/services/auth/otp-login.service.ts
//
// Passwordless OTP login — a CUSTOMER-ONLY surface. Request issues (and
// throttles) a one-time code to the caller's channel; verify redeems it and
// returns the customer for the controller to mint a session. Enumeration-safe
// throughout: unknown contacts get the same response and timing as known ones.
import bcrypt from 'bcrypt';

import { type Customer, TokenType } from '#config/prismaClient.js';
import { buildOtpLoginEmail } from '#mail/auth-emails.js';
import { makeSendCritical } from '#notifications/critical.js';
import { type AuthCore } from '#services/auth/core.js';
import {
  type AuthDeps,
  DUMMY_PASSWORD_HASH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  type OtpContact,
} from '#services/auth/shared.js';
import { generateOtpCode } from '#utils/security-token.js';

export const makeOtpLoginService = (d: AuthDeps, core: AuthCore) => {
  const { clock, logger, mail, notify, prisma } = d;
  const sendCritical = makeSendCritical({ logger, mail });
  const {
    consumeSecurityCode,
    findCustomerByContact,
    invalidOtpError,
    issueSecurityToken,
    updateAuthState,
  } = core;

  /**
   * Passwordless login step 1 — issues a one-time code. Silent no-op for
   * unknown contacts (same response as known ones — no enumeration); for a
   * real account a 6-digit code is issued (replacing any prior live one) and
   * sent to the channel the caller identified themselves by. Re-requests
   * inside the cooldown are silently dropped: a 429 here would only ever fire
   * for contacts that HAVE an account, leaking existence — the response must
   * be indistinguishable from the unknown-contact path. Abuse control is the
   * per-IP rate limiter on the route.
   */
  const requestOtpLogin = async (contact: OtpContact): Promise<void> => {
    const customer = await findCustomerByContact(contact);
    if (!customer) {
      // Spend comparable work to the known-contact path so response timing
      // doesn't reveal whether the contact has an account.
      await bcrypt.compare('otp-timing-guard', DUMMY_PASSWORD_HASH);
      logger.info(
        { event: 'otp_login_unknown_contact' },
        'OTP login requested for an unknown contact',
      );
      return;
    }

    const latest = await prisma.userSecurityToken.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { customerId: customer.id, type: TokenType.OTP_LOGIN },
    });
    if (
      latest &&
      clock.timestamp() - latest.createdAt.getTime() <
        OTP_RESEND_COOLDOWN_SECONDS * 1000
    ) {
      logger.info(
        { customerId: customer.id, event: 'otp_login_cooldown' },
        'OTP re-request inside cooldown dropped',
      );
      return;
    }

    const code = generateOtpCode();
    await issueSecurityToken(
      'customer',
      customer.id,
      TokenType.OTP_LOGIN,
      code,
      OTP_TTL_MINUTES,
    );

    const message = `Your TravelTrek login code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`;
    if (contact.email && customer.email) {
      // Awaited, and a failure reaches the caller as a 503: telling someone
      // "code sent" for mail that never left strands them on the code screen
      // with the resend cooldown running. The enumeration-safe silence above
      // covers unknown contacts; this path is already a known account.
      await sendCritical(
        {
          ...buildOtpLoginEmail(customer.name, code, OTP_TTL_MINUTES),
          to: customer.email,
        },
        'OTP email',
      );
    } else if (contact.phone && customer.phone) {
      notify.sms({ message, to: customer.phone }, 'OTP SMS');
    }
  };

  /**
   * Verifies a passwordless login code and returns the customer (the
   * controller mints tokens / sets cookies). Wrong guesses increment the
   * code's attempt counter — at the cap the code is dead and a fresh one must
   * be requested. A correct guess is consumed atomically (redeemable at most
   * once) and clears any password-failure lockout state.
   *
   * 2FA note: OTP login BYPASSES twoFactorEnabled by design — the emailed/
   * texted code already proves possession of the account's channel, which is
   * exactly the factor 2FA would ask for a second time.
   */
  const verifyOtpLogin = async (
    contact: OtpContact,
    code: string,
  ): Promise<Customer> => {
    const customer = await findCustomerByContact(contact);
    if (!customer) throw invalidOtpError();

    await consumeSecurityCode(
      'customer',
      customer.id,
      TokenType.OTP_LOGIN,
      code,
      OTP_MAX_ATTEMPTS,
      invalidOtpError,
    );

    // A successful OTP login is as good as a correct password: clear the
    // failure counter and any temporary lock.
    if (customer.failedLoginAttempts > 0 || customer.lockedUntil) {
      await updateAuthState('customer', customer.id, {
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    }

    return customer;
  };

  return { requestOtpLogin, verifyOtpLogin };
};
