// src/validations/flight-validation.ts
import { validator } from './validation-factory';
import { ValidationChain } from 'express-validator';
import prisma from '../config/prismaClient';
import { FlightStatus } from '../../generated/prisma';

export const createFlightValidation: ValidationChain[] = [
  validator.string('flightNumber', {
    required: true,
    minLength: 3,
    maxLength: 15,
    pattern: /^[A-Z0-9]{2,3}[0-9]{1,4}$/,
    customMessage: 'Flight number must be in format like AA123, BA1234, etc.',
  }),

  validator.string('airline', {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z\s\-&.()]+$/,
    customMessage:
      'Airline must contain only letters, spaces, hyphens, ampersands, dots, and parentheses',
  }),

  validator.date('departure', {
    required: true,
    minDate: new Date(),
  }),

  validator.date('arrival', {
    required: true,
    compareDateField: 'departure',
    compareDateOperation: 'after',
  }),

  validator.number('originId', {
    required: true,
    min: 1,
  }),

  validator.number('destinationId', {
    required: true,
    min: 1,
  }),

  validator.number('price', {
    required: true,
    min: 0,
    allowDecimals: true,
  }),

  validator.enum(
    'flightClass',
    ['Economy', 'Premium Economy', 'Business', 'First'],
    {
      required: true,
    },
  ),

  validator.number('stops', {
    required: false,
    min: 0,
    max: 5,
  }),

  validator.number('capacity', {
    required: true,
    min: 1,
    max: 850,
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
    required: false,
    minLength: 3,
    maxLength: 10,
    pattern: /^[A-Z0-9]{2,3}[0-9]{1,4}$/,
    customMessage: 'Flight number must be in format like AA123, BA1234, etc.',
  }),

  validator.string('airline', {
    required: false,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z\s\-&.()]+$/,
    customMessage:
      'Airline must contain only letters, spaces, hyphens, ampersands, dots, and parentheses',
  }),

  validator.date('departure', {
    required: false,
    minDate: new Date(),
  }),

  validator.date('arrival', {
    required: false,
    compareDateField: 'departure',
    compareDateOperation: 'after',
  }),

  validator.number('originId', {
    required: false,
    min: 1,
  }),

  validator.number('destinationId', {
    required: false,
    min: 1,
  }),

  validator.number('price', {
    required: false,
    min: 1,
    allowDecimals: true,
  }),

  validator.enum(
    'flightClass',
    ['Economy', 'Premium Economy', 'Business', 'First'],
    {
      required: false,
    },
  ),

  validator.integer('stops', {
    required: false,
    min: 0,
    max: 5,
  }),

  validator.number('capacity', {
    required: false,
    min: 0,
    max: 850,
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
          where: { id: parseInt(flightId) },
          select: { originId: true, destinationId: true },
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
          where: { id: parseInt(flightId) },
          select: { departure: true },
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
        flightNumber,
        airline,
        departure,
        arrival,
        originId,
        destinationId,
        price,
        flightClass,
        duration,
        stops,
        seatsAvailable,
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
    required: false,
    min: 1,
  }),

  validator.number('limit', {
    required: false,
    min: 1,
    max: 100,
  }),

  validator.string('search', {
    required: false,
    minLength: 1,
    maxLength: 100,
    customMessage: 'Search term must be between 1 and 100 characters',
  }),

  validator.string('airline', {
    required: false,
    minLength: 2,
    maxLength: 100,
    customMessage: 'Airline filter must be between 2 and 100 characters',
  }),

  validator.number('originId', {
    required: false,
    min: 1,
  }),

  validator.number('destinationId', {
    required: false,
    min: 1,
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
    required: false,
    compareDateField: 'departureFrom',
    compareDateOperation: 'after-or-same',
  }),

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

  validator.number('maxDuration', {
    required: false,
    min: 30,
    max: 1440,
  }),

  validator.number('maxStops', {
    required: false,
    min: 0,
    max: 5,
  }),

  validator.number('minSeats', {
    required: false,
    min: 1,
    max: 850,
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
