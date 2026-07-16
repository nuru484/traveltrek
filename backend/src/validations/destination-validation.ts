import { ValidationChain } from 'express-validator';

import prisma from '../config/prismaClient';
// src/validations/destination-validation.ts
import { validator } from '../validations/validation-factory';

// Validation for creating a new destination
export const createDestinationValidation: ValidationChain[] = [
  // Name validation
  validator.string('name', {
    customMessage: 'Destination name must be between 2 and 100 characters',
    maxLength: 100,
    minLength: 2,
    required: true,
  }),

  // Description validation (optional)
  validator.string('description', {
    customMessage: 'Description must not exceed 1000 characters',
    maxLength: 1000,
    required: false,
  }),

  // Country validation
  validator.string('country', {
    customMessage:
      'Country must contain only letters, spaces, hyphens, and apostrophes',
    maxLength: 100,
    minLength: 2,
    pattern: /^[a-zA-Z\s\-']+$/,
    required: true,
  }),

  // City validation (optional)
  validator.string('city', {
    customMessage:
      'City must contain only letters, spaces, hyphens, and apostrophes',
    maxLength: 100,
    pattern: /^[a-zA-Z\s\-']+$/,
    required: false,
  }),

  // Custom validation to ensure name is unique (case-insensitive)
  validator.custom(
    'name',
    async (value, req) => {
      if (!value) return true;

      const { city, country } = req.body;
      const existingDestination = await prisma.destination.findFirst({
        where: {
          city: city
            ? {
                equals: city,
                mode: 'insensitive',
              }
            : undefined,
          country: {
            equals: country,
            mode: 'insensitive',
          },
          name: {
            equals: value,
            mode: 'insensitive',
          },
        },
      });

      return !existingDestination;
    },
    'A destination with this name already exists in the specified country/city',
    { required: false },
  ),
];

// Validation for updating an existing destination
export const updateDestinationValidation: ValidationChain[] = [
  // Name validation (optional for updates)
  validator.string('name', {
    customMessage: 'Destination name must be between 2 and 100 characters',
    maxLength: 100,
    minLength: 2,
    required: false,
  }),

  // Description validation (optional)
  validator.string('description', {
    customMessage: 'Description must not exceed 1000 characters',
    maxLength: 1000,
    required: false,
  }),

  // Country validation (optional for updates)
  validator.string('country', {
    customMessage:
      'Country must contain only letters, spaces, hyphens, and apostrophes',
    maxLength: 100,
    minLength: 2,
    pattern: /^[a-zA-Z\s\-']+$/,
    required: false,
  }),

  // City validation (optional)
  validator.string('city', {
    customMessage:
      'City must contain only letters, spaces, hyphens, and apostrophes',
    maxLength: 100,
    pattern: /^[a-zA-Z\s\-']+$/,
    required: false,
  }),

  // Custom validation to ensure updated name is unique (excluding current destination)
  validator.custom(
    'name',
    async (value, req) => {
      if (!value) return true;

      const destinationId = req.params?.id;
      if (!destinationId) return true;

      const { city, country } = req.body;

      // Get current destination data for comparison
      const currentDestination = await prisma.destination.findUnique({
        select: { city: true, country: true },
        where: { id: parseInt(destinationId) },
      });

      if (!currentDestination) return true;

      // Use provided values or fall back to current values
      const targetCountry = country || currentDestination.country;
      const targetCity = city || currentDestination.city;

      const existingDestination = await prisma.destination.findFirst({
        where: {
          city: targetCity
            ? {
                equals: targetCity,
                mode: 'insensitive',
              }
            : undefined,
          country: {
            equals: targetCountry,
            mode: 'insensitive',
          },
          id: { not: parseInt(destinationId) },
          name: {
            equals: value,
            mode: 'insensitive',
          },
        },
      });

      return !existingDestination;
    },
    'A destination with this name already exists in the specified country/city',
    { required: false },
  ),

  // Custom validation to ensure at least one field is being updated
  validator.custom(
    'updateFields',
    (value, req) => {
      const { city, country, description, name } = req.body;
      const hasFile = req.file || req.body.destinationPhoto;

      return !!(name || description || country || city || hasFile);
    },
    'At least one field must be provided for update',
    { required: false },
  ),
];

// Validation for destination ID parameter
export const destinationIdParamValidation: ValidationChain[] = [
  validator.integer('id', {
    min: 1,
    required: true,
  }),
];

// Validation for pagination query parameters
export const paginationQueryValidation: ValidationChain[] = [
  validator.integer('page', {
    min: 1,
    required: false,
  }),

  validator.integer('limit', {
    max: 100, // Prevent excessive limit values
    min: 1,
    required: false,
  }),
];

// Validation for destination search/filter parameters
export const destinationSearchValidation: ValidationChain[] = [
  // Search by name (optional)
  validator.string('search', {
    customMessage: 'Search term must be between 1 and 100 characters',
    maxLength: 100,
    minLength: 1,
    required: false,
  }),

  // Filter by country (optional)
  validator.string('country', {
    customMessage:
      'Country filter must contain only letters, spaces, hyphens, and apostrophes',
    maxLength: 100,
    minLength: 2,
    pattern: /^[a-zA-Z\s\-']+$/,
    required: false,
  }),

  // Filter by city (optional)
  validator.string('city', {
    customMessage:
      'City filter must contain only letters, spaces, hyphens, and apostrophes',
    maxLength: 100,
    minLength: 1,
    pattern: /^[a-zA-Z\s\-']+$/,
    required: false,
  }),

  // Sort order validation
  validator.enum(
    'sortBy',
    ['name', 'country', 'city', 'createdAt', 'updatedAt'],
    {
      required: false,
    },
  ),

  validator.enum('sortOrder', ['asc', 'desc'], {
    required: false,
  }),
];

// Combined validation for getting destinations with filters
export const getDestinationsValidation: ValidationChain[] = [
  ...paginationQueryValidation,
  ...destinationSearchValidation,
];

// Validation for bulk operations
export const bulkDestinationValidation: ValidationChain[] = [
  validator.array('destinationIds', {
    itemType: 'number',
    maxLength: 50, // Limit bulk operations
    minLength: 1,
    required: true,
    unique: true,
  }),

  // Custom validation to ensure all IDs are positive integers
  validator.custom(
    'destinationIds',
    (value: number[]) => {
      if (!Array.isArray(value)) return false;
      return value.every((id) => Number.isInteger(id) && id > 0);
    },
    'All destination IDs must be positive integers',
    { required: false },
  ),
];

// Validation for destination photo handling
export const destinationPhotoValidation: ValidationChain[] = [
  // Custom validation for file type (this would be handled by multer, but adding for completeness)
  validator.custom(
    'destinationPhoto',
    (value, req) => {
      const file = req.file;
      if (!file) return true; // Photo is optional

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

  // Custom validation for file size (this would also be handled by multer)
  validator.custom(
    'destinationPhoto',
    (value, req) => {
      const file = req.file;
      if (!file) return true; // Photo is optional

      const maxSize = 5 * 1024 * 1024; // 5MB
      return file.size <= maxSize;
    },
    'Photo size must not exceed 5MB',
    { required: false },
  ),
];
