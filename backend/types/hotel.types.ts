export interface IHotelInput {
  name: string;
  description?: string | null;
  address: string;
  phone?: string | null;
  starRating?: number;
  amenities: string[];
  destinationId: number;
  hotelPhoto?: string | Express.Multer.File;
}

export interface IHotelUpdateInput extends Partial<IHotelInput> {
  id: number;
}

export interface IHotelRoom {
  id: number;
  roomType: string;
  description: string | null;
  photo: string | null;
  pricePerNight: number;
}

export interface IHotelDestination {
  id: number;
  name: string;
  description: string | null;
  country: string;
  city: string | null;
}

export interface IHotel {
  id: number;
  name: string;
  description: string | null;
  address: string;
  rooms: IHotelRoom[] | null;
  phone: string | null;
  starRating: number;
  amenities: string[];
  photo: string | null;
  destination: IHotelDestination | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHotelResponse {
  message: string;
  data: IHotel;
}

export interface IHotelsPaginatedResponse {
  message: string;
  data: IHotel[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IHotelQueryParams {
  page?: number;
  limit?: number;
  destinationId?: number;
  city?: string;
  search?: string;
  country?: string;
  starRating?: number;
  minStarRating?: number;
  maxStarRating?: number;
  amenities?: string | string[];
  sortBy?: string | 'createdAt';
  sortOrder?: string | 'desc';
}
