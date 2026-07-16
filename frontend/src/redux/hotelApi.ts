// src/redux/hotelApi.ts
import { apiSlice } from "./apiSlice";
import {
  IHotelResponse,
  IHotelsPaginatedResponse,
  IHotelQueryParams,
} from "@/types/hotel.types";
import { IApiResponse } from "@/types/api";

export const hotelApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Create a new hotel
    createHotel: builder.mutation<IApiResponse<IHotelResponse>, FormData>({
      query: (formData) => ({
        url: "/hotels",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Hotels", "Hotel"],
    }),

    // Get all hotels (paginated + filters)
    getAllHotels: builder.query<IHotelsPaginatedResponse, IHotelQueryParams>({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            if (Array.isArray(value)) {
              searchParams.append(key, value.join(","));
            } else {
              searchParams.append(key, String(value));
            }
          }
        });

        const queryString = searchParams.toString();
        return {
          url: `/hotels${queryString ? `?${queryString}` : ""}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: "Hotel" as const, id })),
              "Hotels",
            ]
          : ["Hotels"],
    }),

    // Get a single hotel
    getHotel: builder.query<IHotelResponse, number>({
      query: (id) => ({
        url: `/hotels/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Hotel", id }],
    }),

    // Update a hotel
    updateHotel: builder.mutation<
      IApiResponse<IHotelResponse>,
      { id: number; formData: FormData }
    >({
      query: ({ id, formData }) => ({
        url: `/hotels/${id}`,
        method: "PUT",
        body: formData,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Hotel", id },
        "Hotels",
        "Hotel",
      ],
    }),

    // Delete a single hotel
    deleteHotel: builder.mutation<{ message: string }, number>({
      query: (id) => ({
        url: `/hotels/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Hotel", id },
        "Hotels",
        "Hotel",
      ],
    }),

    // Get hotels by destination
    getHotelsByDestination: builder.query<
      IHotelsPaginatedResponse,
      { destinationId: string } & Omit<IHotelQueryParams, "destinationId">
    >({
      query: ({ destinationId, ...params }) => {
        const searchParams = new URLSearchParams({ destinationId });

        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            if (Array.isArray(value)) {
              searchParams.append(key, value.join(","));
            } else {
              searchParams.append(key, String(value));
            }
          }
        });

        return {
          url: `/hotels?${searchParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["Hotels"],
    }),
  }),
});

export const {
  useCreateHotelMutation,
  useGetAllHotelsQuery,
  useGetHotelQuery,
  useUpdateHotelMutation,
  useDeleteHotelMutation,
  useGetHotelsByDestinationQuery,

  // Lazy hooks
  useLazyGetAllHotelsQuery,
  useLazyGetHotelQuery,
  useLazyGetHotelsByDestinationQuery,
} = hotelApi;
