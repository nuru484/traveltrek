// src/redux/customerApi.ts
//
// Customers domain (backend src/routes/customer.ts):
// - GET    /customers                (staff; page/limit/search)
// - POST   /customers                (staff; JSON — no upload middleware)
// - GET    /customers/:id            (staff or self; profile DTO + stats)
// - GET    /customers/:id/bookings   (full paginated booking history)
// - GET    /customers/:id/payments   (full paginated payment history)
// - PUT    /customers/:id            (self or staff; multipart)
// - DELETE /customers/:id            (ADMIN)
import { apiSlice } from "./apiSlice";
import {
  ICustomerCreateInput,
  ICustomerHistoryQueryParams,
  ICustomerProfileResponse,
  ICustomerResponse,
  ICustomersPaginatedResponse,
  ICustomersQueryParams,
  IDeleteCustomerResponse,
} from "@/types/customer.types";
import { IBookingsPaginatedResponse } from "@/types/booking.types";
import { IPaymentsPaginatedResponse } from "@/types/payment.types";

const buildQueryString = (params: Record<string, unknown> = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
};

export const customerApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get all customers (staff only)
    getAllCustomers: builder.query<
      ICustomersPaginatedResponse,
      ICustomersQueryParams
    >({
      query: (params = {}) => ({
        url: `/customers${buildQueryString(params as Record<string, unknown>)}`,
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({
                type: "Customer" as const,
                id,
              })),
              "Customers",
            ]
          : ["Customers"],
    }),

    // Get a customer profile (base DTO + stats)
    getCustomer: builder.query<
      ICustomerProfileResponse,
      { customerId: number }
    >({
      query: ({ customerId }) => ({
        url: `/customers/${customerId}`,
        method: "GET",
      }),
      providesTags: (result, error, { customerId }) => [
        { type: "Customer", id: customerId },
      ],
    }),

    // Full paginated booking history for a customer
    getCustomerBookingHistory: builder.query<
      IBookingsPaginatedResponse,
      { customerId: number; params?: ICustomerHistoryQueryParams }
    >({
      query: ({ customerId, params = {} }) => ({
        url: `/customers/${customerId}/bookings${buildQueryString(
          params as Record<string, unknown>
        )}`,
        method: "GET",
      }),
      providesTags: (result, error, { customerId }) => [
        { type: "CustomerBookings", id: customerId },
        "Bookings",
      ],
    }),

    // Full paginated payment history for a customer
    getCustomerPaymentHistory: builder.query<
      IPaymentsPaginatedResponse,
      { customerId: number; params?: ICustomerHistoryQueryParams }
    >({
      query: ({ customerId, params = {} }) => ({
        url: `/customers/${customerId}/payments${buildQueryString(
          params as Record<string, unknown>
        )}`,
        method: "GET",
      }),
      providesTags: (result, error, { customerId }) => [
        { type: "CustomerPayments", id: customerId },
        "Payments",
      ],
    }),

    // Create a customer (staff side; JSON body)
    createCustomer: builder.mutation<ICustomerResponse, ICustomerCreateInput>({
      query: (data) => ({
        url: "/customers",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Customers"],
    }),

    // Update a customer (multipart — profilePicture upload supported)
    updateCustomer: builder.mutation<
      ICustomerResponse,
      { customerId: number; data: FormData }
    >({
      query: ({ customerId, data }) => ({
        url: `/customers/${customerId}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { customerId }) => [
        { type: "Customer", id: customerId },
        "Customers",
        // The customer summary is embedded in booking/payment rows.
        "Bookings",
        "Payments",
      ],
    }),

    // Delete a customer (ADMIN only)
    deleteCustomer: builder.mutation<IDeleteCustomerResponse, number>({
      query: (customerId) => ({
        url: `/customers/${customerId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, customerId) => [
        { type: "Customer", id: customerId },
        "Customers",
      ],
    }),
  }),
});

export const {
  useGetAllCustomersQuery,
  useGetCustomerQuery,
  useGetCustomerBookingHistoryQuery,
  useGetCustomerPaymentHistoryQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,

  useLazyGetAllCustomersQuery,
} = customerApi;
