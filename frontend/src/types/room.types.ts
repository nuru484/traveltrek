// src/types/room.types.ts

export interface IRoomHotel {
  id: number;
  name: string;
  description: string | null;
}

export interface IRoom {
  id: number;
  roomType: string;
  price: number;
  capacity: number;
  description: string | null;
  amenities: string[];
  photo: string | null;
  totalRooms: number;
  roomsAvailable: number;
  hotel: IRoomHotel | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoomResponse {
  message: string;
  data: IRoom;
}

export interface IRoomsPaginatedResponse {
  message: string;
  data: IRoom[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IRoomQueryParams {
  page?: number;
  limit?: number;
  hotelId?: number;
  roomType?: string;
  available?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minCapacity?: number;
  maxCapacity?: number;
  amenities?: string | string[];
  sortBy?: string | "createdAt" | "price" | "capacity";
  sortOrder?: string | "desc" | "asc";
}
