// src/redux/bookingApi.ts
import { apiSlice } from "./apiSlice";
import {
  IBookingResponse,
  IBookingCancelResponse,
  IBookingsPaginatedResponse,
  IBookingInput,
  IUpdateBookingInput,
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

    // Cancel a booking (customer own / staff any). A paid booking parks its
    // payment on REFUND_REQUESTED, so payment caches must refresh too; item
    // tags mirror updateBooking (availability counters are restored).
    cancelBooking: builder.mutation<IBookingCancelResponse, number>({
      query: (bookingId) => ({
        url: `/bookings/${bookingId}/cancel`,
        method: "POST",
      }),
      invalidatesTags: (result, error, bookingId) => [
        { type: "Booking", id: bookingId },
        "Bookings",
        "CustomerBookings",
        "Payment",
        "Payments",
        "CustomerPayments",
        "Hotels",
        "Flight",
        "Flights",
        "Tours",
        "Tour",
        "Dashboard",
        "NeedsAttention",
        "MyReport",
        "AgentActivity",
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
  useCancelBookingMutation,
  useDeleteBookingMutation,
  useSearchBookingsQuery,

  useLazyGetAllBookingsQuery,
  useLazyGetAllCustomerBookingsQuery,
  useLazySearchBookingsQuery,
} = bookingApi;
