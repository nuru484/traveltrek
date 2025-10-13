export interface IRoomInput {
  hotelId: number;
  roomType: string;
  pricePerNight: number;
  capacity: number;
  totalRooms: number;
  description?: string;
  amenities?: string[];
  roomPhoto?: string | Express.Multer.File;
}

export interface IRoomUpdateInput extends Partial<IRoomInput> {
  id: number;
}

export interface IRoomHotel {
  id: number;
  name: string;
  description: string | null;
}

export interface IRoom {
  id: number;
  roomType: string;
  pricePerNight: number;
  capacity: number;
  description: string | null;
  amenities: string[];
  photo: string | null;
  totalRooms: number;
  roomsAvailable: number;
  roomsBooked: number;
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
  minPrice?: number;
  maxPrice?: number;
  minCapacity?: number;
  maxCapacity?: number;
  amenities?: string | string[];
  sortBy?: string | 'createdAt';
  sortOrder?: string | 'desc';
  startDate?: string;
  endDate?: string;
}

export interface IRoomAvailability {
  roomId: number;
  totalRooms: number;
  bookedRooms: number;
  availableRooms: number;
  startDate: Date;
  endDate: Date;
}