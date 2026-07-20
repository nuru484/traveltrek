// src/redux/auth/authApi.ts
import { apiSlice } from "../apiSlice";
import { userLoggedIn, userLoggedOut, userRegistration } from "./authSlice";
import {
  IChangeEmailInput,
  IChangePasswordInput,
  IChangePhoneInput,
  IConfirmEmailChangeInput,
  IConfirmPhoneChangeInput,
  IDemoLoginInput,
  IForgotPasswordInput,
  IGoogleSignInInput,
  ILoginResponseData,
  IOtpRequestInput,
  IOtpVerifyInput,
  IResetPasswordInput,
  ITwoFactorCodeInput,
  ITwoFactorStatus,
  IUserRegistrationResponseData,
  isTwoFactorRequired,
} from "../../types/auth/index";
import { IApiResponse } from "../../types/api";

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    registerUser: builder.mutation<
      IApiResponse<IUserRegistrationResponseData>,
      FormData
    >({
      query: (formData) => ({
        url: "auth/register-user",
        method: "POST",
        body: formData,
      }),
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const result = await queryFulfilled;
          dispatch(
            userRegistration({
              user: result.data.data,
            })
          );
        } catch {
          // errors are surfaced by the calling form
        }
      },
    }),

    // A 2FA-enabled account answers { twoFactorRequired: true } WITHOUT
    // cookies — no user may be stored until /auth/2fa/verify completes.
    login: builder.mutation<
      IApiResponse<ILoginResponseData>,
      { email: string; password: string }
    >({
      query: (data) => ({
        url: "auth/login",
        method: "POST",
        body: data,
      }),

      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const result = await queryFulfilled;

          if (!isTwoFactorRequired(result.data.data)) {
            dispatch(
              userLoggedIn({
                user: result.data.data,
              })
            );
          }
        } catch {
          // errors are surfaced by the calling form
        }
      },
    }),

    // Server-side demo login: the client only names a role — the credentials
    // live entirely on the server. Success is the exact login envelope
    // (cookies + DTO), so the session hydrates identically to a real login.
    // No 2FA path (demo accounts are fixtures). A 403 means demo login is
    // disabled; a 404 means the role's account isn't seeded.
    demoLogin: builder.mutation<
      IApiResponse<IUserRegistrationResponseData>,
      IDemoLoginInput
    >({
      query: (data) => ({
        url: "auth/demo-login",
        method: "POST",
        body: data,
      }),
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const result = await queryFulfilled;
          dispatch(userLoggedIn({ user: result.data.data }));
        } catch {
          // errors are surfaced by the calling page
        }
      },
    }),

    // Login second step — unauthenticated, gated by the pending 2FA cookie.
    // Success is the exact login envelope (cookies + DTO).
    twoFactorVerify: builder.mutation<
      IApiResponse<IUserRegistrationResponseData>,
      ITwoFactorCodeInput
    >({
      query: (data) => ({
        url: "auth/2fa/verify",
        method: "POST",
        body: data,
      }),
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const result = await queryFulfilled;
          dispatch(userLoggedIn({ user: result.data.data }));
        } catch {
          // errors are surfaced by the calling form
        }
      },
    }),

    // Always 200 (cooldown re-requests are silently dropped server-side).
    twoFactorResend: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: "auth/2fa/resend",
        method: "POST",
      }),
    }),

    // --- Authenticated security settings ---

    // Sets the first password (no currentPassword) or rotates an existing
    // one; success re-issues THIS session's cookies (every other session dies).
    changePassword: builder.mutation<{ message: string }, IChangePasswordInput>(
      {
        query: (data) => ({
          url: "auth/change-password",
          method: "POST",
          body: data,
        }),
      }
    ),

    // --- Secure contact changes (email/phone are login identifiers) ---

    // Re-auth code for passwordless accounts — the 2FA challenge engine
    // sends a 6-digit code to the account's CURRENT contact.
    reauthChallenge: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: "auth/reauth/challenge",
        method: "POST",
      }),
    }),

    // Parks the new address; the confirmation link goes to the NEW inbox.
    changeEmail: builder.mutation<{ message: string }, IChangeEmailInput>({
      query: (data) => ({
        url: "auth/change-email",
        method: "POST",
        body: data,
      }),
    }),

    // PUBLIC: the emailed token is the credential. Success bumps the session
    // epoch — every session (including this one) signs in again.
    confirmEmailChange: builder.mutation<
      { message: string },
      IConfirmEmailChangeInput
    >({
      query: (data) => ({
        url: "auth/confirm-email-change",
        method: "POST",
        body: data,
      }),
    }),

    // Parks the new number; an OTP goes to the NEW phone.
    changePhone: builder.mutation<{ message: string }, IChangePhoneInput>({
      query: (data) => ({
        url: "auth/change-phone",
        method: "POST",
        body: data,
      }),
    }),

    // AUTHENTICATED: the code proves possession of the new phone. Success
    // re-mints THIS session's cookies; the caller refreshes the stored user.
    confirmPhoneChange: builder.mutation<
      { message: string },
      IConfirmPhoneChangeInput
    >({
      query: (data) => ({
        url: "auth/confirm-phone-change",
        method: "POST",
        body: data,
      }),
    }),

    twoFactorStatus: builder.query<IApiResponse<ITwoFactorStatus>, void>({
      query: () => ({
        url: "auth/2fa/status",
        method: "GET",
      }),
      providesTags: ["TwoFactor"],
    }),

    // Sends the code BOTH enable and disable consume; 400 when the account
    // has neither email nor phone.
    twoFactorChallenge: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: "auth/2fa/challenge",
        method: "POST",
      }),
    }),

    twoFactorEnable: builder.mutation<{ message: string }, ITwoFactorCodeInput>(
      {
        query: (data) => ({
          url: "auth/2fa/enable",
          method: "POST",
          body: data,
        }),
        invalidatesTags: ["TwoFactor"],
      }
    ),

    twoFactorDisable: builder.mutation<
      { message: string },
      ITwoFactorCodeInput
    >({
      query: (data) => ({
        url: "auth/2fa/disable",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["TwoFactor"],
    }),

    // Passwordless OTP login, step 1 — always replies 200 (no enumeration).
    otpRequest: builder.mutation<{ message: string }, IOtpRequestInput>({
      query: (data) => ({
        url: "auth/otp/request",
        method: "POST",
        body: data,
      }),
    }),

    // Passwordless OTP login, step 2 — a full login (cookies + customer DTO).
    otpVerify: builder.mutation<
      IApiResponse<IUserRegistrationResponseData>,
      IOtpVerifyInput
    >({
      query: (data) => ({
        url: "auth/otp/verify",
        method: "POST",
        body: data,
      }),
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const result = await queryFulfilled;
          dispatch(userLoggedIn({ user: result.data.data }));
        } catch {
          // errors are surfaced by the calling form
        }
      },
    }),

    // Always replies 200 (no enumeration); the emailed link targets /reset-password.
    forgotPassword: builder.mutation<{ message: string }, IForgotPasswordInput>(
      {
        query: (data) => ({
          url: "auth/forgot-password",
          method: "POST",
          body: data,
        }),
      }
    ),

    // Consumes the emailed single-use token and kills every live session.
    resetPassword: builder.mutation<{ message: string }, IResetPasswordInput>({
      query: (data) => ({
        url: "auth/reset-password",
        method: "POST",
        body: data,
      }),
    }),

    // Google sign-in (customer-only surface; 503 when the backend is unconfigured).
    googleSignIn: builder.mutation<
      IApiResponse<IUserRegistrationResponseData>,
      IGoogleSignInInput
    >({
      query: (data) => ({
        url: "auth/google",
        method: "POST",
        body: data,
      }),
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          const result = await queryFulfilled;
          dispatch(userLoggedIn({ user: result.data.data }));
        } catch {
          // errors are surfaced by the calling form
        }
      },
    }),

    logout: builder.mutation<string, void>({
      query: () => ({
        url: "auth/logout",
        method: "POST",
      }),

      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        try {
          await queryFulfilled;
          dispatch(userLoggedOut());
        } catch {
          // errors are surfaced by the calling form
        }
      },
    }),
  }),
});

export const {
  useRegisterUserMutation,
  useLoginMutation,
  useDemoLoginMutation,
  useTwoFactorVerifyMutation,
  useTwoFactorResendMutation,
  useChangePasswordMutation,
  useReauthChallengeMutation,
  useChangeEmailMutation,
  useConfirmEmailChangeMutation,
  useChangePhoneMutation,
  useConfirmPhoneChangeMutation,
  useTwoFactorStatusQuery,
  useTwoFactorChallengeMutation,
  useTwoFactorEnableMutation,
  useTwoFactorDisableMutation,
  useOtpRequestMutation,
  useOtpVerifyMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGoogleSignInMutation,
  useLogoutMutation,
} = authApi;
