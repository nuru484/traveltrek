// types/destination.types.ts

export interface IDestinationInput {
  name: string;
  description?: string;
  country: string;
  city?: string;
  destinationPhoto?: string | Express.Multer.File;
}

export interface IDestinationUpdateInput {
  name?: string;
  description?: string;
  country?: string;
  city?: string;
  destinationPhoto?: string | Express.Multer.File;
}

export interface IDestinationResponse {
  id: number;
  name: string;
  description: string | null;
  country: string;
  city: string | null;
  photo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDestinationsPaginatedResponse {
  message: string;
  data: IDestinationResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IDestinationSummary {
  id: number;
  name: string;
  city: string | null;
  country: string;
}
