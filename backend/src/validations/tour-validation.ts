import { ValidationChain } from 'express-validator';

import { TourStatus, TourType } from '../../generated/prisma/client';
import prisma from '../config/prismaClient';
// src/validations/tour-validation.ts
import { validator } from '../validations/validation-factory';

export const createTourValidation: ValidationChain[] = [
  validator.string('name', {
    customMessage: 'Tour name must be between 3 and 200 characters',
    maxLength: 200,
    minLength: 3,
    required: true,
  }),

  validator.string('description', {
    customMessage: 'Description must not exceed 5000 characters',
    maxLength: 5000,
    required: false,
  }),

  validator.enum('type', Object.values(TourType), { required: true }),

  validator.number('price', {
    allowDecimals: true,
    max: 10_000_000,
    min: 0,
    required: true,
  }),

  validator.integer('maxGuests', {
    max: 1000,
    min: 1,
    required: true,
  }),

  validator.date('startDate', {
    minDate: new Date(),
    required: true,
  }),

  validator.date('endDate', {
    compareDateField: 'startDate',
    compareDateOperation: 'after',
    required: true,
  }),

  validator.number('destinationId', {
    min: 1,
    required: true,
  }),
];

export const updateTourValidation: ValidationChain[] = [
  validator.string('name', {
    customMessage: 'Tour name must be between 3 and 200 characters',
    maxLength: 200,
    minLength: 3,
    required: false,
  }),

  validator.string('description', {
    customMessage: 'Description must not exceed 5000 characters',
    maxLength: 5000,
    required: false,
  }),

  validator.enum('type', Object.values(TourType), { required: false }),

  validator.number('price', {
    allowDecimals: true,
    max: 10_000_000,
    min: 0,
    required: false,
  }),

  validator.integer('maxGuests', {
    max: 1000,
    min: 1,
    required: false,
  }),

  validator.date('startDate', {
    minDate: new Date(),
    required: false,
  }),

  validator.date('endDate', {
    required: false,
  }),

  validator.custom(
    'endDate',
    (value: string, req) => {
      if (!value) return true;

      const endDate = new Date(value);
      const startDate = req.body.startDate
        ? new Date(req.body.startDate)
        : null;

      if (!startDate) return true;

      return endDate > startDate;
    },
    'End date must be after start date',
    { required: false },
  ),

  validator.number('destinationId', {
    min: 1,
    required: false,
  }),
];

export const tourIdParamValidation: ValidationChain[] = [
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

export const tourSearchValidation: ValidationChain[] = [
  validator.string('search', {
    customMessage: 'Search term must be between 1 and 200 characters',
    maxLength: 200,
    minLength: 1,
    required: false,
  }),

  validator.enum('type', Object.values(TourType), { required: false }),

  validator.enum('status', Object.values(TourStatus), { required: false }),

  validator.number('minPrice', {
    allowDecimals: true,
    min: 0,
    required: false,
  }),

  validator.number('maxPrice', {
    allowDecimals: true,
    min: 0,
    required: false,
  }),

  validator.custom(
    'maxPrice',
    (value: number, req) => {
      const minPrice = req.query?.minPrice;
      if (!value || !minPrice) return true;

      return parseFloat(value.toString()) >= parseFloat(minPrice.toString());
    },
    'Maximum price must be greater than or equal to minimum price',
    { required: false },
  ),

  validator.integer('minDuration', {
    min: 1,
    required: false,
  }),

  validator.integer('maxDuration', {
    min: 1,
    required: false,
  }),

  validator.custom(
    'maxDuration',
    (value: number, req) => {
      const minDuration = req.query?.minDuration;
      if (!value || !minDuration) return true;

      return parseInt(value.toString()) >= parseInt(minDuration.toString());
    },
    'Maximum duration must be greater than or equal to minimum duration',
    { required: false },
  ),

  validator.integer('minGuests', {
    min: 1,
    required: false,
  }),

  validator.integer('maxGuests', {
    max: 1000,
    min: 1,
    required: false,
  }),

  validator.custom(
    'maxGuests',
    (value: number, req) => {
      const minGuests = req.query?.minGuests;
      if (!value || !minGuests) return true;

      return parseInt(value.toString()) >= parseInt(minGuests.toString());
    },
    'Maximum guests must be greater than or equal to minimum guests',
    { required: false },
  ),

  validator.date('startDate', {
    required: false,
  }),

  validator.date('endDate', {
    required: false,
  }),

  validator.boolean('availableOnly', {
    required: false,
  }),

  validator.enum(
    'sortBy',
    [
      'createdAt',
      'updatedAt',
      'startDate',
      'endDate',
      'price',
      'duration',
      'maxGuests',
      'guestsBooked',
      'name',
    ],
    { required: false },
  ),

  validator.enum('sortOrder', ['asc', 'desc'], {
    required: false,
  }),
];

export const getAllToursValidation: ValidationChain[] = [
  ...paginationQueryValidation,
  ...tourSearchValidation,
];

export const bulkTourValidation: ValidationChain[] = [
  validator.array('tourIds', {
    itemType: 'number',
    maxLength: 100,
    minLength: 1,
    required: true,
    unique: true,
  }),

  validator.custom(
    'tourIds',
    (value: number[]) => {
      if (!Array.isArray(value)) return false;
      return value.every((id) => Number.isInteger(id) && id > 0);
    },
    'All tour IDs must be positive integers',
    { required: false },
  ),
];

export const tourAvailabilityValidation: ValidationChain[] = [
  validator.integer('tourId', {
    min: 1,
    required: true,
  }),

  validator.custom(
    'tourId',
    async (value: number) => {
      if (!value) return true;

      const tour = await prisma.tour.findUnique({
        where: { id: Number(value) },
      });

      return !!tour;
    },
    'Tour does not exist',
    { required: false },
  ),

  validator.integer('guests', {
    max: 1000,
    min: 1,
    required: true,
  }),

  validator.custom(
    'guests',
    async (value: number, req) => {
      const tourId = req.body.tourId || req.query.tourId;
      if (!value || !tourId) return true;

      const tour = await prisma.tour.findUnique({
        select: { guestsBooked: true, maxGuests: true },
        where: { id: Number(tourId) },
      });

      if (!tour) return true;

      const availableSeats = tour.maxGuests - tour.guestsBooked;
      return value <= availableSeats;
    },
    'Requested number of guests exceeds available seats',
    { required: false },
  ),
];

export const tourDateRangeValidation: ValidationChain[] = [
  validator.date('fromDate', {
    required: true,
  }),

  validator.date('toDate', {
    compareDateField: 'fromDate',
    compareDateOperation: 'after-or-same',
    required: true,
  }),
];

export const updateTourStatusValidation: ValidationChain[] = [
  validator.enum('status', Object.values(TourStatus), { required: true }),
];
