import { IDestinationSummary } from './destination.types';
export interface ITourInput {
  name: string;
  description?: string | null;
  type: 'ADVENTURE' | 'CULTURAL' | 'BEACH' | 'CITY' | 'WILDLIFE' | 'CRUISE';
  price: number;
  maxGuests: number;
  startDate: string | Date;
  endDate: string | Date;
  destinationId: number;
}

export interface ITourResponse {
  id: number;
  name: string;
  description: string | null;
  type: 'ADVENTURE' | 'CULTURAL' | 'BEACH' | 'CITY' | 'WILDLIFE' | 'CRUISE';
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  duration: number;
  price: number;
  maxGuests: number;
  guestsBooked: number;
  startDate: Date;
  endDate: Date;
  destination: IDestinationSummary;
  createdAt: Date;
  updatedAt: Date;
}
