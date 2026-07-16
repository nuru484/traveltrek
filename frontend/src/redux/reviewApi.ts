// src/redux/reviewApi.ts
//
// Review endpoints. The authed surface mirrors backend routes/review.ts
// (customer create/mine/update/delete, staff list, admin moderation). The
// public detail endpoint (/public/…/:id) is same-origin and unauthenticated —
// it feeds the read-only "what guests said" section on dashboard detail
// pages, where the authed tour/hotel/flight DTO carries no reviews.
import { apiSlice } from "./apiSlice";
import type { IApiResponse } from "@/types/api";
import type {
  ICreateReviewInput,
  IPublicReview,
  IRatingSummary,
  IReview,
  IReviewsPaginatedResponse,
  IReviewsQueryParams,
  IUpdateReviewInput,
  ReviewStatus,
} from "@/types/review.types";

/** Public detail payloads embed the first 5 published reviews + the total. */
export interface IPublicItemReviews {
  rating: IRatingSummary;
  reviews: IPublicReview[];
  reviewsTotal: number;
}

export type PublicReviewTargetKind = "tours" | "hotels" | "flights";

/** Review changes move the aggregate rating every tour/hotel/flight DTO
 *  carries, so mutations refresh those caches too. */
const RATING_CARRIER_TAGS = [
  "Tour",
  "Tours",
  "Hotel",
  "Hotels",
  "Flight",
  "Flights",
] as const;

export const reviewApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createReview: builder.mutation<IApiResponse<IReview>, ICreateReviewInput>({
      query: (body) => ({
        url: "/reviews",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Reviews", "MyReviews", ...RATING_CARRIER_TAGS],
    }),

    getMyReviews: builder.query<
      IReviewsPaginatedResponse,
      { page?: number; limit?: number }
    >({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) searchParams.append(key, String(value));
        });
        const queryString = searchParams.toString();
        return {
          url: `/reviews/mine${queryString ? `?${queryString}` : ""}`,
          method: "GET",
        };
      },
      providesTags: ["MyReviews"],
    }),

    getAllReviews: builder.query<
      IReviewsPaginatedResponse,
      IReviewsQueryParams
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
          url: `/reviews${queryString ? `?${queryString}` : ""}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({
                type: "Review" as const,
                id,
              })),
              "Reviews",
            ]
          : ["Reviews"],
    }),

    updateReview: builder.mutation<IApiResponse<IReview>, IUpdateReviewInput>({
      query: ({ id, ...body }) => ({
        url: `/reviews/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Review", id },
        "Reviews",
        "MyReviews",
        ...RATING_CARRIER_TAGS,
      ],
    }),

    updateReviewStatus: builder.mutation<
      IApiResponse<IReview>,
      { id: number; status: ReviewStatus }
    >({
      query: ({ id, status }) => ({
        url: `/reviews/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Review", id },
        "Reviews",
        ...RATING_CARRIER_TAGS,
      ],
    }),

    deleteReview: builder.mutation<{ message: string }, number>({
      query: (id) => ({
        url: `/reviews/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Reviews", "MyReviews", ...RATING_CARRIER_TAGS],
    }),

    // Published reviews for one tour/hotel/flight, via the public detail
    // endpoint (first 5 + total). No cookies needed; the shared base query
    // sending them anyway is harmless.
    getPublicItemReviews: builder.query<
      IPublicItemReviews,
      { kind: PublicReviewTargetKind; id: number }
    >({
      query: ({ kind, id }) => ({
        url: `/public/${kind}/${id}`,
        method: "GET",
      }),
      transformResponse: (response: {
        data: IPublicItemReviews;
      }): IPublicItemReviews => ({
        rating: response.data.rating,
        reviews: response.data.reviews,
        reviewsTotal: response.data.reviewsTotal,
      }),
      providesTags: ["Reviews"],
    }),
  }),
});

export const {
  useCreateReviewMutation,
  useGetMyReviewsQuery,
  useGetAllReviewsQuery,
  useUpdateReviewMutation,
  useUpdateReviewStatusMutation,
  useDeleteReviewMutation,
  useGetPublicItemReviewsQuery,
} = reviewApi;
