// src/validations/bookingValidations.ts
import { validator } from './validation-factory';
import { ValidationChain } from 'express-validator';

export const createBookingValidation: ValidationChain[] = [
  validator.integer('userId', {
    required: true,
    min: 1,
  }),

  validator.integer('tourId', {
    required: false,
    min: 1,
  }),

  validator.integer('hotelId', {
    required: false,
    min: 1,
  }),

  validator.integer('roomId', {
    required: false,
    min: 1,
  }),

  validator.integer('flightId', {
    required: false,
    min: 1,
  }),

  validator.number('totalPrice', {
    required: true,
    min: 0,
    allowDecimals: true,
  }),

  validator.custom(
    'bookingType',
    (value, req) => {
      const { tourId, hotelId, roomId, flightId } = req.body;
      return !!(tourId || hotelId || roomId || flightId);
    },
    'At least one of tourId, hotelId, roomId, or flightId must be provided',
    { required: false },
  ),

  validator.custom(
    'roomHotelConsistency',
    (value, req) => {
      const { hotelId, roomId } = req.body;
      if (roomId && !hotelId) {
        return false;
      }
      return true;
    },
    'Hotel ID must be provided when Room ID is specified',
    { required: false },
  ),
];

export const updateBookingValidation: ValidationChain[] = [
  validator.integer('userId', {
    required: false,
    min: 1,
  }),

  validator.integer('tourId', {
    required: false,
    min: 1,
  }),

  validator.integer('hotelId', {
    required: false,
    min: 1,
  }),

  validator.integer('roomId', {
    required: false,
    min: 1,
  }),

  validator.integer('flightId', {
    required: false,
    min: 1,
  }),

  validator.number('totalPrice', {
    required: false,
    min: 0,
    allowDecimals: true,
  }),

  validator.enum('status', ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'], {
    required: false,
  }),

  validator.custom(
    'roomHotelConsistency',
    (value, req) => {
      const { hotelId, roomId } = req.body;
      if (roomId && !hotelId) {
        return false;
      }
      return true;
    },
    'Hotel ID must be provided when Room ID is specified',
    { required: false },
  ),
];

export const bookingIdParamValidation: ValidationChain[] = [
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
    max: 100,
  }),
];

export const bookingStatusFilterValidation: ValidationChain[] = [
  validator.enum('status', ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'], {
    required: false,
  }),
];

export const dateRangeFilterValidation: ValidationChain[] = [
  validator.date('startDate', {
    required: false,
    maxDate: new Date(),
  }),

  validator.date('endDate', {
    required: false,
    compareDateField: 'startDate',
    compareDateOperation: 'after-or-same',
  }),
];

export const getBookingsValidation: ValidationChain[] = [
  ...paginationQueryValidation,
  ...bookingStatusFilterValidation,
  ...dateRangeFilterValidation,
];
