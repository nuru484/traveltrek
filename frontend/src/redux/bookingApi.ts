// src/redux/bookingApi.ts
import { apiSlice } from "./apiSlice";
import {
  IBookingResponse,
  IBookingsPaginatedResponse,
  IBookingInput,
  IUpdateBookingInput,
  IDeleteBookingsResponse,
  IBookingsQueryParams,
} from "@/types/booking.types";

export const bookingApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get all bookings
    getAllBookings: builder.query<
      IBookingsPaginatedResponse,
      IBookingsQueryParams
    >({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            searchParams.append(key, String(value));
          }
        });

        return {
          url: `/bookings${
            searchParams.toString() ? `?${searchParams.toString()}` : ""
          }`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({
                type: "Booking" as const,
                id,
              })),
              "Bookings",
            ]
          : ["Bookings"],
    }),

    // Bookings hang off Customers (backend: GET /bookings/customer/:customerId)
    getAllCustomerBookings: builder.query<
      IBookingsPaginatedResponse,
      { customerId: number; params?: IBookingsQueryParams }
    >({
      query: ({ customerId, params = {} }) => {
        const searchParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            searchParams.append(key, String(value));
          }
        });

        return {
          url: `/bookings/customer/${customerId}${
            searchParams.toString() ? `?${searchParams.toString()}` : ""
          }`,
          method: "GET",
        };
      },
      providesTags: (result, error, { customerId }) =>
        result
          ? [
              ...result.data.map(({ id }) => ({
                type: "Booking" as const,
                id,
              })),
              { type: "CustomerBookings" as const, id: customerId },
              "Bookings",
            ]
          : [{ type: "CustomerBookings" as const, id: customerId }],
    }),

    // Get booking by ID
    getBooking: builder.query<IBookingResponse, { bookingId: number }>({
      query: ({ bookingId }) => ({
        url: `/bookings/${bookingId}`,
        method: "GET",
      }),
      providesTags: (result, error, { bookingId }) => [
        { type: "Booking", id: bookingId },
      ],
    }),

    // Create booking
    createBooking: builder.mutation<IBookingResponse, IBookingInput>({
      query: (data) => ({
        url: "/bookings",
        method: "POST",
        body: data,
      }),
      invalidatesTags: [
        "Bookings",
        "CustomerBookings",
        "Hotels",
        "Flight",
        "Flights",
        "Tours",
        "Tour",
        "Rooms",
        "Room",
      ],
    }),

    // Update booking
    updateBooking: builder.mutation<
      IBookingResponse,
      { bookingId: number; data: IUpdateBookingInput }
    >({
      query: ({ bookingId, data }) => ({
        url: `/bookings/${bookingId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { bookingId }) => [
        { type: "Booking", id: bookingId },
        "Bookings",
        "CustomerBookings",
        "Hotels",
        "Flight",
        "Flights",
        "Tours",
        "Tour",
      ],
    }),

    // Delete a booking
    deleteBooking: builder.mutation<{ message: string }, number>({
      query: (bookingId) => ({
        url: `/bookings/${bookingId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, bookingId) => [
        { type: "Booking", id: bookingId },
        "Bookings",
        "CustomerBookings",
        "Hotels",
        "Flight",
        "Flights",
        "Tours",
        "Tour",
      ],
    }),

    // Delete all bookings (Admin only)
    deleteAllBookings: builder.mutation<
      IDeleteBookingsResponse,
      { confirmDelete: string }
    >({
      query: (body) => ({
        url: "/bookings",
        method: "DELETE",
        body,
      }),
      invalidatesTags: [
        "Bookings",
        "CustomerBookings",
        "Hotels",
        "Flight",
        "Flights",
        "Tours",
        "Tour",
      ],
    }),

    // Search bookings
    searchBookings: builder.query<
      IBookingsPaginatedResponse,
      { search: string } & Omit<IBookingsQueryParams, "search">
    >({
      query: ({ search, ...params }) => {
        const searchParams = new URLSearchParams({ search });

        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });

        return {
          url: `/bookings?${searchParams.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["Bookings"],
    }),
  }),
});

export const {
  useGetAllBookingsQuery,
  useGetAllCustomerBookingsQuery,
  useGetBookingQuery,
  useCreateBookingMutation,
  useUpdateBookingMutation,
  useDeleteBookingMutation,
  useDeleteAllBookingsMutation,
  useSearchBookingsQuery,

  useLazyGetAllBookingsQuery,
  useLazyGetAllCustomerBookingsQuery,
  useLazySearchBookingsQuery,
} = bookingApi;
