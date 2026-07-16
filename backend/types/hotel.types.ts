export interface IHotel {
  address: string;
  amenities: string[];
  createdAt: Date;
  description: null | string;
  destination: IHotelDestination | null;
  id: number;
  name: string;
  phone: null | string;
  photo: null | string;
  rooms: IHotelRoom[] | null;
  starRating: number;
  updatedAt: Date;
}

export interface IHotelDestination {
  city: null | string;
  country: string;
  description: null | string;
  id: number;
  name: string;
}

export interface IHotelInput {
  address: string;
  amenities: string[];
  description?: null | string;
  destinationId: number;
  hotelPhoto?: Express.Multer.File | string;
  name: string;
  phone?: null | string;
  starRating?: number;
}

export interface IHotelQueryParams {
  amenities?: string | string[];
  city?: string;
  country?: string;
  destinationId?: number;
  limit?: number;
  maxStarRating?: number;
  minStarRating?: number;
  page?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  starRating?: number;
}

export interface IHotelResponse {
  data: IHotel;
  message: string;
}

export interface IHotelRoom {
  description: null | string;
  id: number;
  photo: null | string;
  pricePerNight: number;
  roomType: string;
}

export interface IHotelsPaginatedResponse {
  data: IHotel[];
  message: string;
  meta: {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
}

export interface IHotelUpdateInput extends Partial<IHotelInput> {
  id: number;
}
