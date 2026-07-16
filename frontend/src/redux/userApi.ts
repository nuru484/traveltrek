// src/redux/userApi.ts
//
// STAFF management: /users is staff-only on the backend (ADMIN/AGENT
// accounts). Customers are managed under /customers (see customerApi).
import { apiSlice } from "./apiSlice";
import {
  IUserResponse,
  IUsersPaginatedResponse,
  IUsersQueryParams,
  StaffRole,
} from "../types/user.types";

export const userApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get all users
    getAllUsers: builder.query<IUsersPaginatedResponse, IUsersQueryParams>({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            searchParams.append(key, String(value));
          }
        });

        return {
          url: `/users${
            searchParams.toString() ? `?${searchParams.toString()}` : ""
          }`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: "User" as const, id })),
              "Users",
            ]
          : ["Users"],
    }),
    getUser: builder.query<IUserResponse, { userId: number }>({
      query: ({ userId }) => ({
        url: `/users/${userId}`,
        method: "GET",
      }),
      providesTags: (result, error, { userId }) => [
        { type: "User", id: userId },
      ],
    }),

    createUser: builder.mutation<IUserResponse, FormData>({
      query: (formData) => ({
        url: "/users",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Users"],
    }),

    updateUserProfile: builder.mutation<
      IUserResponse,
      { userId: number; data: FormData }
    >({
      query: ({ userId, data }) => ({
        url: `/users/${userId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { userId }) => [
        { type: "User", id: userId },
        "Users",
      ],
    }),

    // Update staff role (backend restricts to ADMIN | AGENT)
    updateUserRole: builder.mutation<
      IUserResponse,
      { userId: number; role: StaffRole }
    >({
      query: ({ userId, role }) => ({
        url: `/users/${userId}/role`,
        method: "PATCH",
        body: { role },
      }),
      invalidatesTags: (result, error, { userId }) => [
        { type: "User", id: userId },
        "Users",
      ],
    }),

    // Delete a single user
    deleteUser: builder.mutation<{ message: string }, number>({
      query: (userId) => ({
        url: `/users/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, userId) => [
        { type: "User", id: userId },
        "Users",
      ],
    }),

    // Search users
    searchUsers: builder.query<
      IUsersPaginatedResponse,
      { search: string } & Omit<IUsersQueryParams, "search">
    >({
      query: ({ search, ...params }) => {
        const searchParams = new URLSearchParams({ search });

        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });

        return {
          url: `/users?${searchParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["Users"],
    }),
  }),
});

export const {
  useGetAllUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserProfileMutation,
  useUpdateUserRoleMutation,
  useDeleteUserMutation,
  useSearchUsersQuery,

  useLazyGetAllUsersQuery,
  useLazySearchUsersQuery,
} = userApi;
