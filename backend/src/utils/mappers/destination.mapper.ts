// src/utils/mappers/destination.mapper.ts
//
// Pure DTO mappers for the destination domain. Services return Prisma rows;
// controllers map them through here so the wire format lives in exactly one
// place and raw DB records never leak.
import type { Destination } from '../../config/prismaClient';

export interface DestinationDTO {
  city: null | string;
  country: string;
  createdAt: Date;
  description: null | string;
  id: number;
  name: string;
  photo: null | string;
  updatedAt: Date;
}

export const toDestinationDTO = (
  destination: Destination,
): DestinationDTO => ({
  city: destination.city,
  country: destination.country,
  createdAt: destination.createdAt,
  description: destination.description,
  id: destination.id,
  name: destination.name,
  photo: destination.photo,
  updatedAt: destination.updatedAt,
});
