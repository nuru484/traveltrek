// types/destination.types.ts

export interface IDestinationInput {
  city?: string;
  country: string;
  description?: string;
  destinationPhoto?: Express.Multer.File | string;
  name: string;
}

export interface IDestinationResponse {
  city: null | string;
  country: string;
  createdAt: Date;
  description: null | string;
  id: number;
  name: string;
  photo: null | string;
  updatedAt: Date;
}

export interface IDestinationsPaginatedResponse {
  data: IDestinationResponse[];
  message: string;
  meta: {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
}

export interface IDestinationSummary {
  city: null | string;
  country: string;
  id: number;
  name: string;
}

export interface IDestinationUpdateInput {
  city?: string;
  country?: string;
  description?: string;
  destinationPhoto?: Express.Multer.File | string;
  name?: string;
}
