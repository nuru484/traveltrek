// src/controllers/authentication/contact-change.ts
//
// Self-service email/phone changes (dms email-change pattern, over BOTH
// principals). Profile updates no longer write login identifiers — these
// verified flows are the only self-service path:
//
// - change-email / change-phone (authenticated): re-auth with the current
//   password (or, for passwordless accounts, the /auth/reauth/challenge
//   code), park the new contact, and send the possession proof to the NEW
//   contact (email link / SMS OTP).
// - confirm-email-change: UNauthenticated — the emailed token is the
//   credential, exactly like reset-password. Applying bumps the session
//   epoch, so every session (including this browser) signs in again with the
//   new email.
// - confirm-phone-change: AUTHENTICATED — the code proves possession of the
//   new phone, the session proves the account. Applying bumps the epoch; the
//   controller re-mints THIS session so the caller stays signed in.
//
// The reauth challenge itself is the existing 2FA challenge engine, mounted
// at POST /auth/reauth/challenge (see routes/authentication/contact-change.ts).
import { Request, RequestHandler, Response } from 'express';

import {
  asyncHandler,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  confirmEmailChange as confirmEmailChangeService,
  confirmPhoneChange as confirmPhoneChangeService,
  mintAuthTokens,
  requestEmailChange,
  requestPhoneChange,
} from '#services/auth.service.js';
import { AccessTokenPayload } from '#types/auth.types.js';
import { CookieManager } from '#utils/CookieManager.js';
import { sendSuccess } from '#utils/http-response.js';
import {
  ChangeEmailBody,
  changeEmailSchema,
  ChangePhoneBody,
  changePhoneSchema,
  ConfirmEmailChangeBody,
  confirmEmailChangeSchema,
  ConfirmPhoneChangeBody,
  confirmPhoneChangeSchema,
} from '#validations/auth-validation.js';

/** Narrows req.user (set by authenticate-jwt) for the authed endpoints. */
const requireActor = (req: Request): AccessTokenPayload => {
  const { user } = req;
  if (!user) {
    throw new UnauthorizedError('Unauthorized, no user provided');
  }
  return user;
};

const handleChangeEmail = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ChangeEmailBody;
  const actor = requireActor(req);

  await requestEmailChange(actor.kind, actor.id, {
    code: body.code,
    currentPassword: body.currentPassword,
    newEmail: body.newEmail,
  });

  sendSuccess(res, {
    message:
      'Almost done — confirm the change from the link we sent to your new email address.',
  });
});
export const changeEmail: RequestHandler[] = [
  ...zodValidation.body(changeEmailSchema),
  handleChangeEmail,
];

// PUBLIC: the emailed token is the credential (like reset-password). On
// success every session is signed out (epoch bump) — the user logs in with
// the new email.
const handleConfirmEmailChange = asyncHandler(
  async (req: Request, res: Response) => {
    const { token } = req.body as ConfirmEmailChangeBody;
    await confirmEmailChangeService(token);

    sendSuccess(res, {
      message:
        'Your email address has been updated. Please log in again with the new address.',
    });
  },
);
export const confirmEmailChange: RequestHandler[] = [
  ...zodValidation.body(confirmEmailChangeSchema),
  handleConfirmEmailChange,
];

const handleChangePhone = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ChangePhoneBody;
  const actor = requireActor(req);

  await requestPhoneChange(actor.kind, actor.id, {
    code: body.code,
    currentPassword: body.currentPassword,
    newPhone: body.newPhone,
  });

  sendSuccess(res, {
    message:
      'Almost done — enter the verification code we sent to your new phone number.',
  });
});
export const changePhone: RequestHandler[] = [
  ...zodValidation.body(changePhoneSchema),
  handleChangePhone,
];

const handleConfirmPhoneChange = asyncHandler(
  async (req: Request, res: Response) => {
    const { code } = req.body as ConfirmPhoneChangeBody;
    const actor = requireActor(req);

    // Returns the principal at its NEW session epoch (the bump killed every
    // already-issued token, including this request's own cookies).
    const principal = await confirmPhoneChangeService(
      actor.kind,
      actor.id,
      code,
    );
    const tokens = await mintAuthTokens(principal);

    CookieManager.setAuthTokens(res, tokens);
    sendSuccess(res, { message: 'Your phone number has been updated.' });
  },
);
export const confirmPhoneChange: RequestHandler[] = [
  ...zodValidation.body(confirmPhoneChangeSchema),
  handleConfirmPhoneChange,
];
