import { apiSlice } from "./apiSlice";
import {
  ITourResponse,
  IToursPaginatedResponse,
  IToursQueryParams,
} from "../types/tour.types";
import { IApiResponse } from "@/types/api";

export const tourApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllTours: builder.query<IToursPaginatedResponse, IToursQueryParams>({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            searchParams.append(key, String(value));
          }
        });

        return {
          url: `/tours${
            searchParams.toString() ? `?${searchParams.toString()}` : ""
          }`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: "Tour" as const, id })),
              "Tours",
            ]
          : ["Tours"],
    }),

    getTour: builder.query<ITourResponse, number>({
      query: (id) => ({
        url: `/tours/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Tour", id }],
    }),

    // Multipart (photo upload via the 'tourPhoto' field) — the browser sets
    // the multipart boundary header itself, same as the hotel mutations.
    createTour: builder.mutation<IApiResponse<ITourResponse>, FormData>({
      query: (formData) => ({
        url: "/tours",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Tour", "Tours"],
    }),

    updateTour: builder.mutation<
      IApiResponse<ITourResponse>,
      { id: number; formData: FormData }
    >({
      query: ({ id, formData }) => ({
        url: `/tours/${id}`,
        method: "PUT",
        body: formData,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Tour", id },
        "Tour",
        "Tours",
      ],
    }),

    updateTourStatus: builder.mutation<
      IApiResponse<ITourResponse>,
      {
        id: number;
        status: string;
      }
    >({
      query: ({ id, status }) => ({
        url: `/tours/${id}/status`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
        }),
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Tour", id },
        "Tour",
        "Tours",
      ],
    }),

    deleteTour: builder.mutation<void, number>({
      query: (id) => ({
        url: `/tours/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Tour"],
    }),

    deleteAllTours: builder.mutation<void, void>({
      query: () => ({
        url: "/tours",
        method: "DELETE",
      }),
      invalidatesTags: ["Tour"],
    }),
  }),
});

export const {
  useGetAllToursQuery,
  useGetTourQuery,
  useCreateTourMutation,
  useUpdateTourMutation,
  useUpdateTourStatusMutation,
  useDeleteTourMutation,
  useDeleteAllToursMutation,
} = tourApi;
