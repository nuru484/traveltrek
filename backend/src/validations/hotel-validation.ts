// src/validations/hotel-validation.ts
import { validator } from '../validations/validation-factory';
import { ValidationChain } from 'express-validator';
import prisma from '../config/prismaClient';

// Validation for creating a new hotel
export const createHotelValidation: ValidationChain[] = [
  validator.string('name', {
    required: true,
    minLength: 2,
    maxLength: 100,
    customMessage: 'Hotel name must be between 2 and 100 characters',
  }),

  validator.string('description', {
    required: false,
    maxLength: 2000,
    customMessage: 'Description must not exceed 2000 characters',
  }),

  validator.string('address', {
    required: true,
    minLength: 5,
    maxLength: 255,
    customMessage: 'Address must be between 5 and 255 characters',
  }),

  validator.phone('phone', {
    required: false,
  }),

  validator.integer('starRating', {
    required: false,
    min: 1,
    max: 5,
  }),

  validator.array('amenities', {
    required: false,
    maxLength: 20,
    itemType: 'string',
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
    required: true,
    min: 1,
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
    required: false,
    minLength: 2,
    maxLength: 100,
    customMessage: 'Hotel name must be between 2 and 100 characters',
  }),

  validator.string('description', {
    required: false,
    maxLength: 2000,
    customMessage: 'Description must not exceed 2000 characters',
  }),

  validator.string('address', {
    required: false,
    minLength: 5,
    maxLength: 255,
    customMessage: 'Address must be between 5 and 255 characters',
  }),

  validator.phone('phone', {
    required: false,
  }),

  validator.integer('starRating', {
    required: false,
    min: 1,
    max: 5,
  }),

  validator.array('amenities', {
    required: false,
    maxLength: 20,
    itemType: 'string',
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
    required: false,
    min: 1,
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
    required: true,
    min: 1,
  }),
];

export const paginationQueryValidation: ValidationChain[] = [
  validator.integer('page', {
    required: false,
    min: 1,
  }),

  validator.integer('limit', {
    required: false,
    min: 1,
    max: 1000,
  }),
];

export const hotelSearchValidation: ValidationChain[] = [
  validator.string('search', {
    required: false,
    minLength: 1,
    maxLength: 100,
    customMessage: 'Search term must be between 1 and 100 characters',
  }),

  validator.integer('destinationId', {
    required: false,
    min: 1,
  }),

  validator.string('city', {
    required: false,
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z\s\-']+$/,
    customMessage:
      'City filter must contain only letters, spaces, hyphens, and apostrophes',
  }),

  validator.string('country', {
    required: false,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z\s\-']+$/,
    customMessage:
      'Country filter must contain only letters, spaces, hyphens, and apostrophes',
  }),

  validator.integer('starRating', {
    required: false,
    min: 1,
    max: 5,
  }),

  validator.integer('minStarRating', {
    required: false,
    min: 1,
    max: 5,
  }),

  validator.integer('maxStarRating', {
    required: false,
    min: 1,
    max: 5,
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
    required: false,
    maxLength: 10,
    itemType: 'string',
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
    required: true,
    minLength: 1,
    maxLength: 50,
    itemType: 'number',
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
