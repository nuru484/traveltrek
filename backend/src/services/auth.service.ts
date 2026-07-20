import { makeChangePasswordService } from '#services/auth/change-password.service.js';
import { makeContactChangeService } from '#services/auth/contact-change.service.js';
import { makeAuthCore } from '#services/auth/core.js';
import { makeDemoLoginService } from '#services/auth/demo-login.service.js';
import { makeGoogleService } from '#services/auth/google.service.js';
import { makeLoginService } from '#services/auth/login.service.js';
import { makeOtpLoginService } from '#services/auth/otp-login.service.js';
import { makePasswordResetService } from '#services/auth/password-reset.service.js';
import { makeRegistrationService } from '#services/auth/registration.service.js';
// src/services/auth.service.ts
//
// Thin composer for the authentication domain (Phase 5b's two-principal
// model — customers + staff Users). The implementation is split into
// focused modules under ./auth: shared.ts (constants/types/pure helpers),
// core.ts (the DI'd engine — principal resolution, session/lockout state,
// token minting/rotation, the single-use security-code engine, the 2FA
// challenge primitives, and the re-auth / cross-table contact guards), and
// one service module per flow. makeAuthService builds the core once and
// spreads each feature factory into a single service object, preserving the
// exact public surface controllers import from this path.
import {
  type AuthDeps,
  type AuthPrincipal,
  type AuthTokens,
  type ChangeEmailInput,
  type ChangePasswordInput,
  type ChangePhoneInput,
  customerPrincipal,
  type DemoRole,
  type LoginInput,
  type LoginResult,
  type OtpContact,
  type RegisteredCustomer,
  type RegisteredUser,
  type RegisterInput,
  staffPrincipal,
  type TokenPrincipal,
  toTokenPrincipal,
  twoFactorChannel,
  type TwoFactorStatus,
} from '#services/auth/shared.js';
import { makeTwoFactorService } from '#services/auth/two-factor.service.js';
import { defaultDeps } from '#services/deps.js';

// Re-export the public types and pure helpers controllers/tests import from
// this module path (unchanged from the pre-split surface).
export {
  type AuthDeps,
  type AuthPrincipal,
  type AuthTokens,
  type ChangeEmailInput,
  type ChangePasswordInput,
  type ChangePhoneInput,
  customerPrincipal,
  type DemoRole,
  type LoginInput,
  type LoginResult,
  type OtpContact,
  type RegisteredCustomer,
  type RegisteredUser,
  type RegisterInput,
  staffPrincipal,
  type TokenPrincipal,
  toTokenPrincipal,
  twoFactorChannel,
  type TwoFactorStatus,
};

export const makeAuthService = (d: AuthDeps) => {
  const core = makeAuthCore(d);
  return {
    ...makeRegistrationService(d),
    ...makeLoginService(d, core),
    ...makeDemoLoginService(d),
    ...makeOtpLoginService(d, core),
    ...makePasswordResetService(d, core),
    ...makeGoogleService(d),
    ...makeTwoFactorService(d, core),
    ...makeChangePasswordService(d, core),
    ...makeContactChangeService(d, core),
    invalidateSession: core.invalidateSession,
    mintAuthTokens: core.mintAuthTokens,
  };
};

export const authService = makeAuthService(defaultDeps);

export const {
  adminCreateUser,
  changePassword,
  confirmEmailChange,
  confirmPhoneChange,
  demoLogin,
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  googleSignIn,
  invalidateSession,
  login,
  logout,
  mintAuthTokens,
  refresh,
  register,
  requestEmailChange,
  requestOtpLogin,
  requestPasswordReset,
  requestPhoneChange,
  requestTwoFactorChallenge,
  resendTwoFactorLogin,
  resetPassword,
  verifyOtpLogin,
  verifyTwoFactorLogin,
} = authService;
