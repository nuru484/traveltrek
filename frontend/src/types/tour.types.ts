export enum TourType {
  ADVENTURE = "ADVENTURE",
  CULTURAL = "CULTURAL",
  BEACH = "BEACH",
  CITY = "CITY",
  WILDLIFE = "WILDLIFE",
  CRUISE = "CRUISE",
}

export enum TourStatus {
  UPCOMING = "UPCOMING",
  ONGOING = "ONGOING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export interface IDestinationSummary {
  id: number;
  name: string;
  city: string | null;
  country: string;
}

export interface ITour {
  id: number;
  name: string;
  description: string | null;
  type: TourType;
  status: TourStatus;
  duration: number;
  /** Integer minor units (pesewas): GH₵ 1.00 = 100. */
  price: number;
  maxGuests: number;
  guestsBooked: number;
  startDate: string;
  endDate: string;
  destination: IDestinationSummary;
  createdAt: string;
  updatedAt: string;
}

export interface ITourResponse {
  message: string;
  data: ITour;
}

export interface IToursQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: TourType;
  status?: TourStatus;
  /** Integer minor units (pesewas): GH₵ 1.00 = 100. */
  minPrice?: number;
  /** Integer minor units (pesewas): GH₵ 1.00 = 100. */
  maxPrice?: number;
  location?: string;
}

export interface IToursPaginatedResponse {
  message: string;
  data: ITour[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ITourInput {
  name: string;
  description?: string | null;
  type: "ADVENTURE" | "CULTURAL" | "BEACH" | "CITY" | "WILDLIFE" | "CRUISE";
  /** Integer minor units (pesewas): GH₵ 1.00 = 100. */
  price: number;
  maxGuests: number;
  startDate: string;
  endDate: string;
  destinationId: number;
}

export interface IUpdateTourInput extends Partial<ITourInput> {
  id: string;
}
