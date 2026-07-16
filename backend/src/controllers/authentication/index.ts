import { changePassword } from '#controllers/authentication/change-password.js';
import { googleSignIn } from '#controllers/authentication/google.js';
import { login } from '#controllers/authentication/login.js';
import logout from '#controllers/authentication/logout.js';
import {
  requestOtp,
  verifyOtp,
} from '#controllers/authentication/otp-login.js';
import {
  forgotPassword,
  resetPassword,
} from '#controllers/authentication/password-reset.js';
import refreshToken from '#controllers/authentication/refresh-jwt-token.js';
import {
  adminCreateUser,
  registerUser,
} from '#controllers/authentication/register.js';
import {
  challengeTwoFactor,
  disableTwoFactor,
  enableTwoFactor,
  resendTwoFactor,
  twoFactorStatus,
  verifyTwoFactor,
} from '#controllers/authentication/two-factor.js';

export {
  adminCreateUser,
  challengeTwoFactor,
  changePassword,
  disableTwoFactor,
  enableTwoFactor,
  forgotPassword,
  googleSignIn,
  login,
  logout,
  refreshToken,
  registerUser,
  requestOtp,
  resendTwoFactor,
  resetPassword,
  twoFactorStatus,
  verifyOtp,
  verifyTwoFactor,
};
