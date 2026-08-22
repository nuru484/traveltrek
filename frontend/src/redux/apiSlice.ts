// src/redux/apiSlice.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { userLoggedIn, userLoggedOut } from "./auth/authSlice";
import { apiSliceTags } from "@/types/api";
import type { IUserRegistrationResponseData } from "@/types/auth";
import type { IApiResponse } from "@/types/api";
import {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { Mutex } from "async-mutex";

// Create a mutex to prevent multiple refresh token calls
const mutex = new Mutex();

// Create the base query instance once to ensure consistency
const baseQuery = fetchBaseQuery({
  baseUrl: `${process.env.NEXT_PUBLIC_SERVER_URI}/api/v1`,
  credentials: "include" as const,
});

/**
 * 401 codes that mean "the submitted credential is wrong", not "the session
 * expired": wrong password at login/change-password, wrong 2FA/OTP
 * code, missing 2FA-pending cookie. Refresh-and-retry must NOT fire for
 * these — the retry would silently re-submit the bad credential and register
 * a second failed attempt toward the backend's lockout counters.
 */
const NON_SESSION_401_CODES = new Set([
  "INVALID_CREDENTIALS",
  "INVALID_2FA_CODE",
  "INVALID_OTP",
  "MISSING_2FA_SESSION",
]);

const isSessionExpiry401 = (error: FetchBaseQueryError): boolean => {
  const { data } = error;
  if (data && typeof data === "object" && "code" in data) {
    const code = (data as { code?: unknown }).code;
    if (typeof code === "string" && NON_SESSION_401_CODES.has(code)) {
      return false;
    }
  }
  return true;
};

// Create a wrapper for the baseQuery
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // Execute the base query
  let result = await baseQuery(args, api, extraOptions);

  // If it's a 401 (Unauthorized) error, try to refresh the token once
  if (
    result.error &&
    result.error.status === 401 &&
    isSessionExpiry401(result.error)
  ) {
    // Check if another request is already refreshing the token
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();

      try {
        // Try to get a new token (one attempt only)

        const refreshResult = await baseQuery(
          { url: "auth/refresh-token", method: "POST" },
          api,
          extraOptions
        );

        if (refreshResult.data) {
          // Token refresh successful, update auth state
          api.dispatch(
            userLoggedIn({
              user: (
                refreshResult.data as IApiResponse<IUserRegistrationResponseData>
              ).data,
            })
          );

          // Retry the original request
          result = await baseQuery(args, api, extraOptions);
        } else {
          // Token refresh failed, log out and redirect to homepage
          api.dispatch(userLoggedOut());
        }
      } finally {
        // Release mutex
        release();
      }
    } else {
      // If mutex is locked, wait and retry the original request
      await mutex.waitForUnlock();
      result = await baseQuery(args, api, extraOptions);
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: apiSliceTags,
  endpoints: (builder) => ({
    refreshToken: builder.mutation<
      IApiResponse<IUserRegistrationResponseData>,
      void
    >({
      query: () => ({
        url: "auth/refresh-token",
        method: "POST",
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
          dispatch(userLoggedOut());
        }
      },
    }),
  }),
});

export const { useRefreshTokenMutation } = apiSlice;
