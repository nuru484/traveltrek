// src/redux/dashboardApi.ts
import { apiSlice } from "./apiSlice";
import {
  IDashboardResponse,
  INeedsAttentionResponse,
} from "@/types/dashboard.types";

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query<IDashboardResponse, void>({
      query: () => ({
        url: "/dashboard",
        method: "GET",
      }),
      providesTags: ["Dashboard"],
    }),

    // Staff-only operational counts for the dashboard attention strip.
    getNeedsAttention: builder.query<INeedsAttentionResponse, void>({
      query: () => ({
        url: "/dashboard/needs-attention",
        method: "GET",
      }),
      providesTags: ["NeedsAttention"],
    }),
  }),
});

export const { useGetDashboardStatsQuery, useGetNeedsAttentionQuery } =
  dashboardApi;
