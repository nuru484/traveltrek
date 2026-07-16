import { ValidationChain } from 'express-validator';

import { FlightStatus } from '../../generated/prisma/client';
import prisma from '../config/prismaClient';
// src/validations/flight-validation.ts
import { validator } from './validation-factory';

export const createFlightValidation: ValidationChain[] = [
  validator.string('flightNumber', {
    customMessage: 'Flight number must be in format like AA123, BA1234, etc.',
    maxLength: 15,
    minLength: 3,
    pattern: /^[A-Z0-9]{2,3}[0-9]{1,4}$/,
    required: true,
  }),

  validator.string('airline', {
    customMessage:
      'Airline must contain only letters, spaces, hyphens, ampersands, dots, and parentheses',
    maxLength: 60,
    minLength: 2,
    pattern: /^[a-zA-Z\s\-&.()]+$/,
    required: true,
  }),

  validator.date('departure', {
    minDate: new Date(),
    required: true,
  }),

  validator.date('arrival', {
    compareDateField: 'departure',
    compareDateOperation: 'after',
    required: true,
  }),

  validator.number('originId', {
    min: 1,
    required: true,
  }),

  validator.number('destinationId', {
    min: 1,
    required: true,
  }),

  validator.number('price', {
    allowDecimals: true,
    max: 10_000_000,
    min: 0,
    required: true,
  }),

  validator.enum(
    'flightClass',
    ['Economy', 'Premium Economy', 'Business', 'First'],
    {
      required: true,
    },
  ),

  validator.number('stops', {
    max: 5,
    min: 0,
    required: false,
  }),

  validator.number('capacity', {
    max: 850,
    min: 1,
    required: true,
  }),

  validator.custom(
    'destinationId',
    (value, req) => {
      const { originId } = req.body;
      return parseInt(value) !== parseInt(originId);
    },
    'Origin and destination must be different',
    { required: false },
  ),

  validator.custom(
    'arrival',
    (value, req) => {
      if (!value || !req.body.departure) return true;

      const departureTime = new Date(req.body.departure);
      const arrivalTime = new Date(value);
      const diffInMinutes =
        (arrivalTime.getTime() - departureTime.getTime()) / (1000 * 60);

      return diffInMinutes >= 30;
    },
    'Arrival time must be at least 30 minutes after departure',
    { required: false },
  ),
];

export const updateFlightValidation: ValidationChain[] = [
  validator.string('flightNumber', {
    customMessage: 'Flight number must be in format like AA123, BA1234, etc.',
    maxLength: 15,
    minLength: 3,
    pattern: /^[A-Z0-9]{2,3}[0-9]{1,4}$/,
    required: false,
  }),

  validator.string('airline', {
    customMessage:
      'Airline must contain only letters, spaces, hyphens, ampersands, dots, and parentheses',
    maxLength: 60,
    minLength: 2,
    pattern: /^[a-zA-Z\s\-&.()]+$/,
    required: false,
  }),

  validator.date('departure', {
    minDate: new Date(),
    required: false,
  }),

  validator.date('arrival', {
    compareDateField: 'departure',
    compareDateOperation: 'after',
    required: false,
  }),

  validator.number('originId', {
    min: 1,
    required: false,
  }),

  validator.number('destinationId', {
    min: 1,
    required: false,
  }),

  validator.number('price', {
    allowDecimals: true,
    min: 1,
    required: false,
  }),

  validator.enum(
    'flightClass',
    ['Economy', 'Premium Economy', 'Business', 'First'],
    {
      required: false,
    },
  ),

  validator.integer('stops', {
    max: 5,
    min: 0,
    required: false,
  }),

  validator.number('capacity', {
    max: 850,
    min: 0,
    required: false,
  }),

  validator.custom(
    'destinationId',
    async (value, req) => {
      const { originId } = req.body;
      const flightId = req.params?.id;

      if (!value && !originId) return true;

      let currentOriginId = originId;
      let currentDestinationId = value;

      if (flightId && (!originId || !value)) {
        const currentFlight = await prisma.flight.findUnique({
          select: { destinationId: true, originId: true },
          where: { id: parseInt(flightId) },
        });

        if (currentFlight) {
          currentOriginId = originId || currentFlight.originId;
          currentDestinationId = value || currentFlight.destinationId;
        }
      }

      return parseInt(currentDestinationId) !== parseInt(currentOriginId);
    },
    'Origin and destination must be different',
    { required: false },
  ),

  validator.custom(
    'arrival',
    async (value, req) => {
      if (!value) return true;

      const { departure } = req.body;
      const flightId = req.params?.id;

      let departureTime = departure ? new Date(departure) : null;

      if (!departureTime && flightId) {
        const currentFlight = await prisma.flight.findUnique({
          select: { departure: true },
          where: { id: parseInt(flightId) },
        });

        if (currentFlight) {
          departureTime = currentFlight.departure;
        }
      }

      if (!departureTime) return true;

      const arrivalTime = new Date(value);
      const diffInMinutes =
        (arrivalTime.getTime() - departureTime.getTime()) / (1000 * 60);

      return diffInMinutes >= 30;
    },
    'Arrival time must be at least 30 minutes after departure',
    { required: false },
  ),

  validator.custom(
    'updateFields',
    (value, req) => {
      const {
        airline,
        arrival,
        departure,
        destinationId,
        duration,
        flightClass,
        flightNumber,
        originId,
        price,
        seatsAvailable,
        stops,
      } = req.body;
      const hasFile = req.file || req.body.flightPhoto;

      return !!(
        flightNumber ||
        airline ||
        departure ||
        arrival ||
        originId ||
        destinationId ||
        price ||
        flightClass ||
        duration ||
        stops !== undefined ||
        seatsAvailable ||
        hasFile
      );
    },
    'At least one field must be provided for update',
    { required: false },
  ),
];

export const flightSearchValidation: ValidationChain[] = [
  validator.number('page', {
    min: 1,
    required: false,
  }),

  validator.number('limit', {
    max: 100,
    min: 1,
    required: false,
  }),

  validator.string('search', {
    customMessage: 'Search term must be between 1 and 100 characters',
    maxLength: 100,
    minLength: 1,
    required: false,
  }),

  validator.string('airline', {
    customMessage: 'Airline filter must be between 2 and 100 characters',
    maxLength: 60,
    minLength: 2,
    required: false,
  }),

  validator.number('originId', {
    min: 1,
    required: false,
  }),

  validator.number('destinationId', {
    min: 1,
    required: false,
  }),

  validator.enum(
    'flightClass',
    ['Economy', 'Premium Economy', 'Business', 'First'],
    {
      required: false,
    },
  ),

  validator.date('departureFrom', {
    required: false,
  }),

  validator.date('departureTo', {
    compareDateField: 'departureFrom',
    compareDateOperation: 'after-or-same',
    required: false,
  }),

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

  validator.number('maxDuration', {
    max: 1440,
    min: 30,
    required: false,
  }),

  validator.number('maxStops', {
    max: 5,
    min: 0,
    required: false,
  }),

  validator.number('minSeats', {
    max: 850,
    min: 1,
    required: false,
  }),

  validator.enum(
    'sortBy',
    [
      'departure',
      'arrival',
      'price',
      'duration',
      'airline',
      'flightNumber',
      'createdAt',
    ],
    {
      required: false,
    },
  ),

  validator.enum('sortOrder', ['asc', 'desc'], {
    required: false,
  }),

  validator.custom(
    'maxPrice',
    (value, req) => {
      const { minPrice } = req.query;
      if (!value || !minPrice) return true;

      return parseFloat(value) >= parseFloat(minPrice);
    },
    'Maximum price must be greater than or equal to minimum price',
    { required: false },
  ),
];

export const getFlightsValidation: ValidationChain[] = [
  ...flightSearchValidation,
];

export const flightPhotoValidation: ValidationChain[] = [
  validator.custom(
    'flightPhoto',
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
    'Flight photo must be a valid image file (JPEG, PNG, or WebP)',
    { required: false },
  ),

  validator.custom(
    'flightPhoto',
    (value, req) => {
      const file = req.file;
      if (!file) return true;

      const maxSize = 5 * 1024 * 1024;
      return file.size <= maxSize;
    },
    'Flight photo size must not exceed 5MB',
    { required: false },
  ),
];

export const updateFlightStatusValidation: ValidationChain[] = [
  validator.enum('status', Object.values(FlightStatus), {
    required: true,
  }),

  validator.date('departure', {
    required: false,
  }),

  validator.date('arrival', {
    required: false,
  }),
];
