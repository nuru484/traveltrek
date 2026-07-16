// src/redux/paymentApi.ts
import { apiSlice } from "./apiSlice";
import {
  IPaymentsPaginatedResponse,
  IPaymentResponse,
  IPaymentInput,
  IUpdatePaymentStatusInput,
  IUpdatePaymentStatusResponse,
  IPaymentInitializeResponse,
  IPaymentVerificationResponse,
  IDeletePaymentResponse,
  IDeleteAllPaymentsResponse,
  IRefundPaymentInput,
  IRefundPaymentResponse,
  IPaymentsQueryParams,
} from "../types/payment.types";

export const paymentApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get all payments
    getAllPayments: builder.query<
      IPaymentsPaginatedResponse,
      IPaymentsQueryParams | void
    >({
      query: (params) => {
        const searchParams = new URLSearchParams();

        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              searchParams.append(key, String(value));
            }
          });
        }

        return {
          url: `/payments${
            searchParams.toString() ? `?${searchParams.toString()}` : ""
          }`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({
                type: "Payment" as const,
                id,
              })),
              { type: "Payments" as const },
            ]
          : [{ type: "Payments" as const }],
    }),

    // Payments hang off Customers (backend: GET /payments/customer/:customerId)
    getAllCustomerPayments: builder.query<
      IPaymentsPaginatedResponse,
      { customerId: number; params?: IPaymentsQueryParams }
    >({
      query: ({ customerId, params }) => {
        const searchParams = new URLSearchParams();

        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              searchParams.append(key, String(value));
            }
          });
        }

        return {
          url: `/payments/customer/${customerId}${
            searchParams.toString() ? `?${searchParams.toString()}` : ""
          }`,
          method: "GET",
        };
      },
      providesTags: (result, error, { customerId }) =>
        result
          ? [
              ...result.data.map(({ id }) => ({
                type: "Payment" as const,
                id,
              })),
              { type: "CustomerPayments" as const, id: customerId },
              { type: "Payments" as const },
            ]
          : [{ type: "CustomerPayments" as const, id: customerId }],
    }),

    // Get payment by ID
    getPayment: builder.query<IPaymentResponse, number>({
      query: (paymentId) => ({
        url: `/payments/${paymentId}`,
        method: "GET",
      }),
      providesTags: (result, error, paymentId) => [
        { type: "Payment" as const, id: paymentId },
      ],
    }),

    // Create/initiate payment
    createPayment: builder.mutation<IPaymentInitializeResponse, IPaymentInput>({
      query: (paymentData) => ({
        url: "/payments",
        method: "POST",
        body: paymentData,
      }),
      invalidatesTags: [
        { type: "Payments" },
        { type: "CustomerPayments" },
        { type: "Bookings" },
      ],
    }),

    // Update payment status (ADMIN only)
    updatePaymentStatus: builder.mutation<
      IUpdatePaymentStatusResponse,
      { paymentId: number; data: IUpdatePaymentStatusInput }
    >({
      query: ({ paymentId, data }) => ({
        url: `/payments/${paymentId}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (result, error, { paymentId }) => [
        { type: "Payment" as const, id: paymentId },
        { type: "Payments" },
        { type: "CustomerPayments" },
        { type: "Bookings" },
      ],
    }),

    // Delete a single payment
    deletePayment: builder.mutation<IDeletePaymentResponse, number>({
      query: (paymentId) => ({
        url: `/payments/${paymentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, paymentId) => [
        { type: "Payment" as const, id: paymentId },
        { type: "Payments" },
        { type: "CustomerPayments" },
        { type: "Bookings" },
      ],
    }),

    // Delete all payments (ADMIN only; the backend accepts no filters)
    deleteAllPayments: builder.mutation<IDeleteAllPaymentsResponse, void>({
      query: () => ({
        url: "/payments",
        method: "DELETE",
      }),
      invalidatesTags: [
        { type: "Payments" },
        { type: "CustomerPayments" },
        { type: "Bookings" },
      ],
    }),

    // Refund a payment (ADMIN only)
    refundPayment: builder.mutation<
      IRefundPaymentResponse,
      { paymentId: number; data?: IRefundPaymentInput }
    >({
      query: ({ paymentId, data = {} }) => ({
        url: `/payments/${paymentId}/refund`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (result, error, { paymentId }) => [
        { type: "Payment" as const, id: paymentId },
        { type: "Payments" },
        { type: "CustomerPayments" },
        { type: "Bookings" },
      ],
    }),

    // Payment callback/verification
    paymentCallback: builder.query<IPaymentVerificationResponse, string>({
      query: (reference) => ({
        url: `/payments/callback?reference=${reference}`,
        method: "GET",
      }),
      providesTags: [{ type: "Payments" }],
    }),
  }),
});

export const {
  // Queries
  useGetAllPaymentsQuery,
  useGetAllCustomerPaymentsQuery,
  useGetPaymentQuery,
  usePaymentCallbackQuery,

  // Mutations
  useCreatePaymentMutation,
  useUpdatePaymentStatusMutation,
  useDeletePaymentMutation,
  useDeleteAllPaymentsMutation,
  useRefundPaymentMutation,

  // Lazy queries
  useLazyGetAllPaymentsQuery,
  useLazyGetAllCustomerPaymentsQuery,
  useLazyPaymentCallbackQuery,
} = paymentApi;
