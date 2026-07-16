// src/redux/destinationApi.ts
import { apiSlice } from "./apiSlice";
import {
  IDestinationApiResponse,
  IDestinationsPaginatedResponse,
  IDestinationQueryParams,
} from "../types/destination.types";
import { IApiResponse } from "@/types/api";

export const destinationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllDestinations: builder.query<
      IDestinationsPaginatedResponse,
      IDestinationQueryParams
    >({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            searchParams.append(key, String(value));
          }
        });

        const queryString = searchParams.toString();
        return {
          url: `/destinations${queryString ? `?${queryString}` : ""}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({
                type: "Destination" as const,
                id,
              })),
              "Destination",
            ]
          : ["Destination"],
    }),

    getDestination: builder.query<IDestinationApiResponse, number>({
      query: (id) => ({
        url: `/destinations/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Destination", id }],
    }),

    createDestination: builder.mutation<IDestinationApiResponse, FormData>({
      query: (formData) => ({
        url: "/destinations",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Destination"],
    }),

    updateDestination: builder.mutation<
      IDestinationApiResponse,
      { id: number; formData: FormData }
    >({
      query: ({ id, formData }) => ({
        url: `/destinations/${id}`,
        method: "PUT",
        body: formData,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Destination", id },
        "Destination",
      ],
    }),

    deleteDestination: builder.mutation<IApiResponse<null>, number>({
      query: (id) => ({
        url: `/destinations/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Destination"],
    }),
  }),
});

export const {
  useGetAllDestinationsQuery,
  useGetDestinationQuery,
  useCreateDestinationMutation,
  useUpdateDestinationMutation,
  useDeleteDestinationMutation,
} = destinationApi;
