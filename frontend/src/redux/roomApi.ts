// src/redux/roomApi.ts
import { apiSlice } from "./apiSlice";
import {
  IRoomResponse,
  IRoomsPaginatedResponse,
  IRoomQueryParams,
} from "@/types/room.types";
import { IApiResponse } from "@/types/api";

export const roomApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Create a new room
    createRoom: builder.mutation<IRoomResponse, FormData>({
      query: (formData) => ({
        url: "/rooms",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Rooms", "Room", "Hotels", "Hotel"],
    }),

    // Get all rooms (paginated + filters)
    getAllRooms: builder.query<IRoomsPaginatedResponse, IRoomQueryParams>({
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
          url: `/rooms${queryString ? `?${queryString}` : ""}`,
          method: "GET",
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: "Room" as const, id })),
              "Rooms",
            ]
          : ["Rooms"],
    }),

    // Get a single room
    getRoom: builder.query<IRoomResponse, number>({
      query: (id) => ({
        url: `/rooms/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Room", id }],
    }),

    // Update a room
    updateRoom: builder.mutation<
      IApiResponse<IRoomResponse>,
      { id: number; formData: FormData }
    >({
      query: ({ id, formData }) => ({
        url: `/rooms/${id}`,
        method: "PUT",
        body: formData,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Room", id },
        "Rooms",
        "Hotels",
        "Hotel",
      ],
    }),

    // Delete a single room
    deleteRoom: builder.mutation<{ message: string }, number>({
      query: (id) => ({
        url: `/rooms/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Room", id },
        "Rooms",
        "Hotels",
        "Hotel",
      ],
    }),
  }),
});

export const {
  useCreateRoomMutation,
  useGetAllRoomsQuery,
  useGetRoomQuery,
  useUpdateRoomMutation,
  useDeleteRoomMutation,

  // Lazy hooks
  useLazyGetAllRoomsQuery,
  useLazyGetRoomQuery,
} = roomApi;
