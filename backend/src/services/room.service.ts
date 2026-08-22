import { defaultDeps } from '#services/deps.js';
// src/services/room.service.ts
//
// Thin composer for the rooms domain. The implementation is split into modules
// under ./room: shared.ts (sort-field whitelist, request/result types), core.ts
// (photo cleanup, availability-window resolution and the booked/available
// counting math, the list where-clause), and one module per surface (create,
// update, query = get/list/check-availability, delete). makeRoomService builds
// the core once and spreads each feature factory into one object, preserving
// the public surface controllers/validation/tests import from this path.
import { makeRoomCore } from '#services/room/core.js';
import { makeRoomCreateService } from '#services/room/create.service.js';
import { makeRoomDeleteService } from '#services/room/delete.service.js';
import { makeRoomQueryService } from '#services/room/query.service.js';
import {
  type DateWindowInput,
  ROOM_SORT_FIELDS,
  type RoomAvailabilityReport,
  type RoomDeleteSummary,
  type RoomDeps,
  type RoomInput,
  type RoomListParams,
  type RoomSortField,
  type RoomUpdateInput,
  type RoomWithAvailability,
} from '#services/room/shared.js';
import { makeRoomUpdateService } from '#services/room/update.service.js';

// Re-export the public types/consts controllers/validation/tests import from
// this module path.
export {
  type DateWindowInput,
  ROOM_SORT_FIELDS,
  type RoomAvailabilityReport,
  type RoomDeleteSummary,
  type RoomInput,
  type RoomListParams,
  type RoomSortField,
  type RoomUpdateInput,
  type RoomWithAvailability,
};

export const makeRoomService = (d: RoomDeps) => {
  const core = makeRoomCore(d);
  return {
    ...makeRoomCreateService(d, core),
    ...makeRoomUpdateService(d, core),
    ...makeRoomQueryService(d, core),
    ...makeRoomDeleteService(d, core),
  };
};

export const roomService = makeRoomService(defaultDeps);

export const {
  checkAvailability,
  createRoom,
  deleteRoom,
  getRoomById,
  listRooms,
  updateRoom,
} = roomService;
