import { IDestinationSummary } from './destination.types';
export interface ITourInput {
  description?: null | string;
  destinationId: number;
  endDate: Date | string;
  maxGuests: number;
  name: string;
  price: number;
  startDate: Date | string;
  type: 'ADVENTURE' | 'BEACH' | 'CITY' | 'CRUISE' | 'CULTURAL' | 'WILDLIFE';
}

export interface ITourResponse {
  createdAt: Date;
  description: null | string;
  destination: IDestinationSummary;
  duration: number;
  endDate: Date;
  guestsBooked: number;
  id: number;
  maxGuests: number;
  name: string;
  price: number;
  startDate: Date;
  status: 'CANCELLED' | 'COMPLETED' | 'ONGOING' | 'UPCOMING';
  type: 'ADVENTURE' | 'BEACH' | 'CITY' | 'CRUISE' | 'CULTURAL' | 'WILDLIFE';
  updatedAt: Date;
}
