// src/redux/flightApi.ts
import { apiSlice } from "./apiSlice";
import {
  IFlightResponse,
  IFlightsPaginatedResponse,
  IFlightsQueryParams,
} from "@/types/flight.types";
import { IApiResponse } from "@/types/api";

export const flightApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllFlights: builder.query<
      IFlightsPaginatedResponse,
      IFlightsQueryParams
    >({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            searchParams.append(key, String(value));
          }
        });

        return {
          url: `/flights${
            searchParams.toString() ? `?${searchParams.toString()}` : ""
          }`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: "Flight" as const, id })),
              "Flights",
            ]
          : ["Flights"],
    }),

    getFlight: builder.query<IFlightResponse, number>({
      query: (id) => ({
        url: `/flights/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Flight", id }],
    }),

    createFlight: builder.mutation<IApiResponse<IFlightResponse>, FormData>({
      query: (formData) => ({
        url: "/flights",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Flight", "Flights"],
    }),
    updateFlight: builder.mutation<
      IApiResponse<IFlightResponse>,
      { id: number; formData: FormData }
    >({
      query: ({ id, formData }) => ({
        url: `/flights/${id}`,
        method: "PUT",
        body: formData,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Flight", id },
        "Flight",
      ],
    }),

    updateFlightStatus: builder.mutation<
      IApiResponse<IFlightResponse>,
      {
        id: number;
        status: string;
        departure?: string;
        arrival?: string;
      }
    >({
      query: ({ id, status, departure, arrival }) => ({
        url: `/flights/${id}/status`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          ...(departure && { departure }),
          ...(arrival && { arrival }),
        }),
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Flight", id },
        "Flight",
        "Flights",
      ],
    }),

    deleteFlight: builder.mutation<void, number>({
      query: (id) => ({
        url: `/flights/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Flight"],
    }),

    deleteAllFlights: builder.mutation<void, void>({
      query: () => ({
        url: "/flights",
        method: "DELETE",
      }),
      invalidatesTags: ["Flight"],
    }),
  }),
});

export const {
  useGetAllFlightsQuery,
  useGetFlightQuery,
  useCreateFlightMutation,
  useUpdateFlightMutation,
  useUpdateFlightStatusMutation,
  useDeleteFlightMutation,
  useDeleteAllFlightsMutation,
} = flightApi;
