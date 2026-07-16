import { ValidationChain } from 'express-validator';

import prisma from '../config/prismaClient';
// src/validations/hotel-validation.ts
import { validator } from '../validations/validation-factory';

// Validation for creating a new hotel
export const createHotelValidation: ValidationChain[] = [
  validator.string('name', {
    customMessage: 'Hotel name must be between 2 and 100 characters',
    maxLength: 100,
    minLength: 2,
    required: true,
  }),

  validator.string('description', {
    customMessage: 'Description must not exceed 2000 characters',
    maxLength: 2000,
    required: false,
  }),

  validator.string('address', {
    customMessage: 'Address must be between 5 and 255 characters',
    maxLength: 255,
    minLength: 5,
    required: true,
  }),

  validator.phone('phone', {
    required: false,
  }),

  validator.integer('starRating', {
    max: 5,
    min: 1,
    required: false,
  }),

  validator.array('amenities', {
    itemType: 'string',
    maxLength: 20,
    required: false,
    unique: true,
  }),

  validator.custom(
    'amenities',
    (value: string[]) => {
      if (!value || !Array.isArray(value)) return true;

      return value.every((amenity) => {
        return (
          typeof amenity === 'string' &&
          amenity.trim().length > 0 &&
          amenity.length <= 50
        );
      });
    },
    'Each amenity must be a non-empty string with maximum 50 characters',
    { required: false },
  ),

  validator.integer('destinationId', {
    min: 1,
    required: true,
  }),

  validator.custom(
    'destinationId',
    async (value: number) => {
      if (!value) return true;

      const destination = await prisma.destination.findUnique({
        where: { id: Number(value) },
      });

      return !!destination;
    },
    'Destination does not exist',
    { required: false },
  ),
];

export const updateHotelValidation: ValidationChain[] = [
  validator.string('name', {
    customMessage: 'Hotel name must be between 2 and 100 characters',
    maxLength: 100,
    minLength: 2,
    required: false,
  }),

  validator.string('description', {
    customMessage: 'Description must not exceed 2000 characters',
    maxLength: 2000,
    required: false,
  }),

  validator.string('address', {
    customMessage: 'Address must be between 5 and 255 characters',
    maxLength: 255,
    minLength: 5,
    required: false,
  }),

  validator.phone('phone', {
    required: false,
  }),

  validator.integer('starRating', {
    max: 5,
    min: 1,
    required: false,
  }),

  validator.array('amenities', {
    itemType: 'string',
    maxLength: 20,
    required: false,
    unique: true,
  }),

  validator.custom(
    'amenities',
    (value: string[]) => {
      if (!value || !Array.isArray(value)) return true;

      return value.every((amenity) => {
        return (
          typeof amenity === 'string' &&
          amenity.trim().length > 0 &&
          amenity.length <= 50
        );
      });
    },
    'Each amenity must be a non-empty string with maximum 50 characters',
    { required: false },
  ),

  validator.integer('destinationId', {
    min: 1,
    required: false,
  }),

  validator.custom(
    'destinationId',
    async (value: number) => {
      if (!value) return true;

      const destination = await prisma.destination.findUnique({
        where: { id: Number(value) },
      });

      return !!destination;
    },
    'Destination does not exist',
    { required: false },
  ),
];

export const hotelIdParamValidation: ValidationChain[] = [
  validator.integer('id', {
    min: 1,
    required: true,
  }),
];

export const paginationQueryValidation: ValidationChain[] = [
  validator.integer('page', {
    min: 1,
    required: false,
  }),

  validator.integer('limit', {
    max: 1000,
    min: 1,
    required: false,
  }),
];

export const hotelSearchValidation: ValidationChain[] = [
  validator.string('search', {
    customMessage: 'Search term must be between 1 and 100 characters',
    maxLength: 100,
    minLength: 1,
    required: false,
  }),

  validator.integer('destinationId', {
    min: 1,
    required: false,
  }),

  validator.string('city', {
    customMessage:
      'City filter must contain only letters, spaces, hyphens, and apostrophes',
    maxLength: 100,
    minLength: 1,
    pattern: /^[a-zA-Z\s\-']+$/,
    required: false,
  }),

  validator.string('country', {
    customMessage:
      'Country filter must contain only letters, spaces, hyphens, and apostrophes',
    maxLength: 100,
    minLength: 2,
    pattern: /^[a-zA-Z\s\-']+$/,
    required: false,
  }),

  validator.integer('starRating', {
    max: 5,
    min: 1,
    required: false,
  }),

  validator.integer('minStarRating', {
    max: 5,
    min: 1,
    required: false,
  }),

  validator.integer('maxStarRating', {
    max: 5,
    min: 1,
    required: false,
  }),

  validator.custom(
    'maxStarRating',
    (value: number, req) => {
      const minStarRating = req.query?.minStarRating;
      if (!value || !minStarRating) return true;

      return parseInt(value.toString()) >= parseInt(minStarRating.toString());
    },
    'Maximum star rating must be greater than or equal to minimum star rating',
    { required: false },
  ),

  validator.array('amenities', {
    itemType: 'string',
    maxLength: 10,
    required: false,
  }),

  validator.enum(
    'sortBy',
    ['name', 'city', 'country', 'starRating', 'createdAt', 'updatedAt'],
    {
      required: false,
    },
  ),

  validator.enum('sortOrder', ['asc', 'desc'], {
    required: false,
  }),
];

export const getHotelsValidation: ValidationChain[] = [
  ...paginationQueryValidation,
  ...hotelSearchValidation,
];

export const bulkHotelValidation: ValidationChain[] = [
  validator.array('hotelIds', {
    itemType: 'number',
    maxLength: 50,
    minLength: 1,
    required: true,
    unique: true,
  }),

  validator.custom(
    'hotelIds',
    (value: number[]) => {
      if (!Array.isArray(value)) return false;
      return value.every((id) => Number.isInteger(id) && id > 0);
    },
    'All hotel IDs must be positive integers',
    { required: false },
  ),
];

export const hotelPhotoValidation: ValidationChain[] = [
  validator.custom(
    'hotelPhoto',
    (value, req) => {
      const file = req.file;
      if (!file) return true;

      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ];
      return allowedMimeTypes.includes(file.mimetype);
    },
    'Photo must be a valid image file (JPEG, PNG, or WebP)',
    { required: false },
  ),

  validator.custom(
    'hotelPhoto',
    (value, req) => {
      const file = req.file;
      if (!file) return true;

      const maxSize = 5 * 1024 * 1024;
      return file.size <= maxSize;
    },
    'Photo size must not exceed 5MB',
    { required: false },
  ),
];
