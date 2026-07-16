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

export {
  adminCreateUser,
  forgotPassword,
  googleSignIn,
  login,
  logout,
  refreshToken,
  registerUser,
  requestOtp,
  resetPassword,
  verifyOtp,
};
