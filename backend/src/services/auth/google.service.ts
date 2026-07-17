// src/services/auth/google.service.ts
//
// Google sign-in — a CUSTOMER-ONLY surface. Verifies the ID token, then
// resolves the account (by googleId, then verified email, else a fresh
// passwordless Customer). Uses only the deps, no auth core.
import { type Customer } from '#config/prismaClient.js';
import {
  ServiceUnavailableError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type AuthDeps } from '#services/auth/shared.js';
import { assertContactFreeAcrossPrincipals } from '#utils/cross-principal-contact.js';

export const makeGoogleService = (d: AuthDeps) => {
  const { config, google, prisma } = d;

  /**
   * Google sign-in — a CUSTOMER-ONLY surface: verifies the ID token via the
   * injected google client, then resolves the account — by googleId first,
   * else by verified email (linking the googleId for next time), else a fresh
   * passwordless Customer. The controller mints tokens / sets cookies for the
   * returned customer. Staff never authenticate via Google.
   *
   * 2FA note: Google sign-in BYPASSES twoFactorEnabled by design — Google
   * already enforces its own possession factor(s) on the account, so the
   * verified ID token is a stronger proof than a password + emailed code.
   */
  const googleSignIn = async (idToken: string): Promise<Customer> => {
    if (!config.GOOGLE_CLIENT_ID) {
      throw new ServiceUnavailableError('Google sign-in is not configured', {
        code: 'GOOGLE_NOT_CONFIGURED',
        layer: 'auth',
      });
    }

    const identity = await google.verifyIdToken(idToken);
    if (!identity) {
      throw new UnauthorizedError('Google sign-in failed. Please try again.', {
        code: 'INVALID_GOOGLE_TOKEN',
        layer: 'auth',
      });
    }

    // findFirst on both lookups: a soft-deleted account can neither sign in
    // nor be linked. Its unique email/googleId stay held (khadys convention),
    // so a re-signup for that identity surfaces as a P2002 conflict.
    const byGoogleId = await prisma.customer.findFirst({
      where: { googleId: identity.googleId },
    });
    if (byGoogleId) return byGoogleId;

    // Only a VERIFIED Google email may claim an existing account (or mint a
    // new one) — otherwise anyone could register an unverified Google account
    // with someone else's address and take over their profile.
    if (!identity.emailVerified) {
      throw new UnauthorizedError(
        'Your Google account email is not verified.',
        { code: 'GOOGLE_EMAIL_UNVERIFIED', layer: 'auth' },
      );
    }

    const byEmail = await prisma.customer.findFirst({
      where: { email: identity.email },
    });
    if (byEmail) {
      return prisma.customer.update({
        data: { googleId: identity.googleId },
        where: { id: byEmail.id },
      });
    }

    // The verified Google email may still belong to a STAFF account — a
    // fresh customer row would shadow it at login, so refuse the mint.
    await assertContactFreeAcrossPrincipals(
      prisma,
      { email: identity.email },
      'customer',
    );

    return prisma.customer.create({
      data: {
        email: identity.email,
        googleId: identity.googleId,
        name: identity.name,
      },
    });
  };

  return { googleSignIn };
};
