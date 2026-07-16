// src/redux/auth/authApi.ts
import { apiSlice } from "../apiSlice";
import { userLoggedIn, userLoggedOut, userRegistration } from "./authSlice";
import {
  IForgotPasswordInput,
  IGoogleSignInInput,
  IOtpRequestInput,
  IOtpVerifyInput,
  IResetPasswordInput,
  IUserRegistrationResponseData,
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

    login: builder.mutation<
      IApiResponse<IUserRegistrationResponseData>,
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

          dispatch(
            userLoggedIn({
              user: result.data.data,
            })
          );
        } catch {
          // errors are surfaced by the calling form
        }
      },
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
  useOtpRequestMutation,
  useOtpVerifyMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGoogleSignInMutation,
  useLogoutMutation,
} = authApi;
