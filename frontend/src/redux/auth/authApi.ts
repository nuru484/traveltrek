// src/redux/auth/authApi.ts
import { apiSlice } from "../apiSlice";
import { userLoggedIn, userLoggedOut, userRegistration } from "./authSlice";
import { IUserRegistrationResponseData } from "../../types/auth/index";
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

export const { useRegisterUserMutation, useLoginMutation, useLogoutMutation } =
  authApi;
