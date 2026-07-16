// src/lib/google-auth.ts
//
// Default `google` dep for AppDeps: verifies a Google ID token (from the
// frontend's Google Sign-In flow) against our OAuth client id and distils the
// claims the auth service needs. Returns null for anything unverifiable —
// the service turns that into a uniform 401. The endpoint itself is gated on
// GOOGLE_CLIENT_ID being configured (503 otherwise), so this module never
// runs with an undefined audience in practice.
import { OAuth2Client } from 'google-auth-library';

import ENV from '#config/env.js';
import logger from '#utils/logger.js';

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  googleId: string;
  name: string;
}

const client = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

/** Verifies a Google ID token; null when invalid/expired/wrong audience. */
export const verifyGoogleIdToken = async (
  idToken: string,
): Promise<GoogleIdentity | null> => {
  try {
    const ticket = await client.verifyIdToken({
      audience: ENV.GOOGLE_CLIENT_ID,
      idToken,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) return null;
    return {
      email: payload.email,
      emailVerified: payload.email_verified ?? false,
      googleId: payload.sub,
      name: payload.name ?? payload.email,
    };
  } catch (error) {
    logger.warn({ err: error }, 'Google ID token verification failed');
    return null;
  }
};
