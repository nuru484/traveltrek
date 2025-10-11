// src/validations/tour-validation.ts
import { validator } from '../validations/validation-factory';
import { ValidationChain } from 'express-validator';
import prisma from '../config/prismaClient';
import { TourType, TourStatus } from '../../generated/prisma/client';

export const createTourValidation: ValidationChain[] = [
  validator.string('name', {
    required: true,
    minLength: 3,
    maxLength: 200,
    customMessage: 'Tour name must be between 3 and 200 characters',
  }),

  validator.string('description', {
    required: false,
    maxLength: 5000,
    customMessage: 'Description must not exceed 5000 characters',
  }),

  validator.enum('type', Object.values(TourType), { required: true }),

  validator.number('price', {
    required: true,
    min: 0,
    allowDecimals: true,
  }),

  validator.integer('maxGuests', {
    required: true,
    min: 1,
    max: 1000,
  }),

  validator.date('startDate', {
    required: true,
    minDate: new Date(),
  }),

  validator.date('endDate', {
    required: true,
    compareDateField: 'startDate',
    compareDateOperation: 'after',
  }),

  validator.number('destinationId', {
    required: true,
    min: 1,
  }),
];

export const updateTourValidation: ValidationChain[] = [
  validator.string('name', {
    required: false,
    minLength: 3,
    maxLength: 200,
    customMessage: 'Tour name must be between 3 and 200 characters',
  }),

  validator.string('description', {
    required: false,
    maxLength: 5000,
    customMessage: 'Description must not exceed 5000 characters',
  }),

  validator.enum('type', Object.values(TourType), { required: false }),

  validator.number('price', {
    required: false,
    min: 0,
    allowDecimals: true,
  }),

  validator.integer('maxGuests', {
    required: false,
    min: 1,
    max: 1000,
  }),

  validator.date('startDate', {
    required: false,
    minDate: new Date(),
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
    required: false,
    min: 1,
  }),
];

export const tourIdParamValidation: ValidationChain[] = [
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

export const tourSearchValidation: ValidationChain[] = [
  validator.string('search', {
    required: false,
    minLength: 1,
    maxLength: 200,
    customMessage: 'Search term must be between 1 and 200 characters',
  }),

  validator.enum('type', Object.values(TourType), { required: false }),

  validator.enum('status', Object.values(TourStatus), { required: false }),

  validator.number('minPrice', {
    required: false,
    min: 0,
    allowDecimals: true,
  }),

  validator.number('maxPrice', {
    required: false,
    min: 0,
    allowDecimals: true,
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
    required: false,
    min: 1,
  }),

  validator.integer('maxDuration', {
    required: false,
    min: 1,
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
    required: false,
    min: 1,
  }),

  validator.integer('maxGuests', {
    required: false,
    min: 1,
    max: 1000,
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
    required: true,
    minLength: 1,
    maxLength: 100,
    itemType: 'number',
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
    required: true,
    min: 1,
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
    required: true,
    min: 1,
    max: 1000,
  }),

  validator.custom(
    'guests',
    async (value: number, req) => {
      const tourId = req.body.tourId || req.query.tourId;
      if (!value || !tourId) return true;

      const tour = await prisma.tour.findUnique({
        where: { id: Number(tourId) },
        select: { maxGuests: true, guestsBooked: true },
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
    required: true,
    compareDateField: 'fromDate',
    compareDateOperation: 'after-or-same',
  }),
];

export const updateTourStatusValidation: ValidationChain[] = [
  validator.enum('status', Object.values(TourStatus), { required: true }),
];
