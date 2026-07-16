export interface IRoom {
  amenities: string[];
  capacity: number;
  createdAt: Date;
  description: null | string;
  hotel: IRoomHotel | null;
  id: number;
  photo: null | string;
  pricePerNight: number;
  roomsAvailable: number;
  roomsBooked: number;
  roomType: string;
  totalRooms: number;
  updatedAt: Date;
}

export interface IRoomAvailability {
  availableRooms: number;
  bookedRooms: number;
  endDate: Date;
  roomId: number;
  startDate: Date;
  totalRooms: number;
}

export interface IRoomHotel {
  description: null | string;
  id: number;
  name: string;
}

export interface IRoomInput {
  amenities?: string[];
  capacity: number;
  description?: string;
  hotelId: number;
  pricePerNight: number;
  roomPhoto?: Express.Multer.File | string;
  roomType: string;
  totalRooms: number;
}

export interface IRoomQueryParams {
  amenities?: string | string[];
  endDate?: string;
  hotelId?: number;
  limit?: number;
  maxCapacity?: number;
  maxPrice?: number;
  minCapacity?: number;
  minPrice?: number;
  page?: number;
  roomType?: string;
  sortBy?: string;
  sortOrder?: string;
  startDate?: string;
}

export interface IRoomResponse {
  data: IRoom;
  message: string;
}

export interface IRoomsPaginatedResponse {
  data: IRoom[];
  message: string;
  meta: {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
}

export interface IRoomUpdateInput extends Partial<IRoomInput> {
  id: number;
}
