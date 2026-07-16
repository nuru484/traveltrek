import { ValidationChain } from 'express-validator';

// src/validations/bookingValidations.ts
import { validator } from './validation-factory';

export const createBookingValidation: ValidationChain[] = [
  validator.integer('userId', {
    min: 1,
    required: true,
  }),

  validator.integer('tourId', {
    min: 1,
    required: false,
  }),

  validator.integer('hotelId', {
    min: 1,
    required: false,
  }),

  validator.integer('roomId', {
    min: 1,
    required: false,
  }),

  validator.integer('flightId', {
    min: 1,
    required: false,
  }),

  validator.number('totalPrice', {
    allowDecimals: true,
    min: 0,
    required: true,
  }),

  validator.custom(
    'bookingType',
    (value, req) => {
      const { flightId, hotelId, roomId, tourId } = req.body;
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
    min: 1,
    required: false,
  }),

  validator.integer('tourId', {
    min: 1,
    required: false,
  }),

  validator.integer('hotelId', {
    min: 1,
    required: false,
  }),

  validator.integer('roomId', {
    min: 1,
    required: false,
  }),

  validator.integer('flightId', {
    min: 1,
    required: false,
  }),

  validator.number('totalPrice', {
    allowDecimals: true,
    min: 0,
    required: false,
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
    max: 100,
    min: 1,
    required: false,
  }),
];

export const bookingStatusFilterValidation: ValidationChain[] = [
  validator.enum('status', ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'], {
    required: false,
  }),
];

export const dateRangeFilterValidation: ValidationChain[] = [
  validator.date('startDate', {
    maxDate: new Date(),
    required: false,
  }),

  validator.date('endDate', {
    compareDateField: 'startDate',
    compareDateOperation: 'after-or-same',
    required: false,
  }),
];

export const getBookingsValidation: ValidationChain[] = [
  ...paginationQueryValidation,
  ...bookingStatusFilterValidation,
  ...dateRangeFilterValidation,
];
