// src/validations/flight-validation.ts
//
// Zod schemas for the flight domain (replaces the express-validator chains).
// Boundary rules only — shape, formats, ranges, enums and date ordering.
// Invariants that need the database (origin/destination existence, route and
// capacity guards, the status state machine, cross-field checks that fall
// back to the stored flight, flightNumber uniqueness — a DB constraint) live
// in services/flight.service.ts; the multer file checks (zod only sees
// req.body) live in the controller's photo-file middleware.
import { z } from 'zod';

import { FlightStatus } from '../config/prismaClient';
import { FLIGHT_SORT_FIELDS } from '../services/flight.service';
import { paginationQuery } from './common-validation';

/** Cabin classes the legacy validation accepted (the column is a string). */
export const FLIGHT_CLASSES = [
  'Economy',
  'Premium Economy',
  'Business',
  'First',
] as const;

const AIRLINE_MESSAGE =
  'Airline must contain only letters, spaces, hyphens, ampersands, dots, and parentheses';
const AIRLINE_PATTERN = /^[a-zA-Z\s\-&.()]+$/;
const FLIGHT_NUMBER_MESSAGE =
  'Flight number must be in format like AA123, BA1234, etc.';
const FLIGHT_NUMBER_PATTERN = /^[A-Z0-9]{2,3}[0-9]{1,4}$/;
const MINUTE_MS = 1000 * 60;

/** A raw query/body date string that must at least parse as a date. */
const dateString = (field: string) =>
  z
    .string(`${field} must be a valid date`)
    .refine((value) => !isNaN(new Date(value).getTime()), {
      error: `${field} must be a valid date`,
    });

const flightFields = z.object({
  airline: z
    .string(AIRLINE_MESSAGE)
    .min(2, 'Airline must be between 2 and 60 characters')
    .max(60, 'Airline must be between 2 and 60 characters')
    .regex(AIRLINE_PATTERN, AIRLINE_MESSAGE),
  arrival: z.coerce.date('arrival must be a valid date'),
  // Multipart form fields arrive as strings, so numbers are coerced.
  capacity: z.coerce
    .number('Capacity must be an integer between 1 and 850')
    .int('Capacity must be an integer between 1 and 850')
    .min(1, 'Capacity must be an integer between 1 and 850')
    .max(850, 'Capacity must be an integer between 1 and 850'),
  departure: z.coerce.date('departure must be a valid date'),
  destinationId: z.coerce
    .number('A valid destinationId is required')
    .int('A valid destinationId is required')
    .min(1, 'A valid destinationId is required'),
  flightClass: z.enum(
    FLIGHT_CLASSES,
    'Flight class must be one of: Economy, Premium Economy, Business, First',
  ),
  flightNumber: z
    .string(FLIGHT_NUMBER_MESSAGE)
    .min(3, FLIGHT_NUMBER_MESSAGE)
    .max(15, FLIGHT_NUMBER_MESSAGE)
    .regex(FLIGHT_NUMBER_PATTERN, FLIGHT_NUMBER_MESSAGE),
  // Either a client-sent URL or, after the Cloudinary middleware runs, the
  // uploaded image URL. A multipart file upload arrives as req.file instead
  // and is guarded by the controller's photo-file middleware.
  flightPhoto: z.string().optional(),
  originId: z.coerce
    .number('A valid originId is required')
    .int('A valid originId is required')
    .min(1, 'A valid originId is required'),
  price: z.coerce
    .number('Price must be a number between 0 and 10,000,000')
    .min(0, 'Price must be a number between 0 and 10,000,000')
    .max(10_000_000, 'Price must be a number between 0 and 10,000,000'),
  stops: z.coerce
    .number('Stops must be an integer between 0 and 5')
    .int('Stops must be an integer between 0 and 5')
    .min(0, 'Stops must be an integer between 0 and 5')
    .max(5, 'Stops must be an integer between 0 and 5')
    .optional(),
});

export const createFlightSchema = flightFields
  .refine((body) => body.departure.getTime() > Date.now(), {
    error: 'Departure time must be in the future',
    path: ['departure'],
  })
  .refine((body) => body.arrival > body.departure, {
    error: 'Arrival time must be after departure time',
    path: ['arrival'],
  })
  .refine(
    (body) =>
      (body.arrival.getTime() - body.departure.getTime()) / MINUTE_MS >= 30,
    {
      error: 'Arrival time must be at least 30 minutes after departure',
      path: ['arrival'],
    },
  )
  .refine((body) => body.destinationId !== body.originId, {
    error: 'Origin and destination must be different',
    path: ['destinationId'],
  });

// Cross-field rules that fall back to the STORED flight when one side is
// omitted (origin/destination distinctness, the 30-minute arrival gap), the
// "at least one field" rule (a photo may arrive as a file zod cannot see) and
// the DELAYED/CANCELLED-only status rule are enforced by the update service.
// Update-specific bounds differ from create on purpose: the legacy chains
// allowed price >= 1 and capacity >= 0 here.
export const updateFlightSchema = flightFields
  .partial()
  .extend({
    capacity: z.coerce
      .number('Capacity must be an integer between 0 and 850')
      .int('Capacity must be an integer between 0 and 850')
      .min(0, 'Capacity must be an integer between 0 and 850')
      .max(850, 'Capacity must be an integer between 0 and 850')
      .optional(),
    price: z.coerce
      .number('Price must be a number greater than or equal to 1')
      .min(1, 'Price must be a number greater than or equal to 1')
      .optional(),
    status: z
      .enum(
        [FlightStatus.DELAYED, FlightStatus.CANCELLED],
        'Admin can only update status to DELAYED or CANCELLED. Other statuses are managed automatically.',
      )
      .optional(),
  })
  .refine((body) => !body.departure || body.departure.getTime() > Date.now(), {
    error: 'Departure time must be in the future',
    path: ['departure'],
  })
  .refine(
    (body) =>
      !body.departure || !body.arrival || body.arrival > body.departure,
    {
      error: 'Arrival time must be after departure time',
      path: ['arrival'],
    },
  );

/**
 * PATCH /flights/:id/status body. Times stay raw strings: only the DELAYED
 * path may use them, and the service parses/rejects them with the legacy
 * messages ("Invalid date format for departure or arrival time.").
 */
export const flightStatusSchema = z.object({
  arrival: z.string().optional(),
  departure: z.string().optional(),
  status: z.enum(FlightStatus, 'Invalid flight status'),
});

export const flightListQuery = paginationQuery
  .extend({
    // The legacy chain capped airline at 60 but reported "100" — kept as-is.
    airline: z
      .string('Airline filter must be between 2 and 100 characters')
      .min(2, 'Airline filter must be between 2 and 100 characters')
      .max(60, 'Airline filter must be between 2 and 100 characters')
      .optional(),
    // Departure-window bounds stay strings so meta.filters echoes them raw.
    departureFrom: dateString('departureFrom').optional(),
    departureTo: dateString('departureTo').optional(),
    destinationId: z.coerce.number().int().min(1).optional(),
    flightClass: z.enum(FLIGHT_CLASSES).optional(),
    maxDuration: z.coerce.number().int().min(30).max(1440).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    maxStops: z.coerce.number().int().min(0).max(5).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    minSeats: z.coerce.number().int().min(1).max(850).optional(),
    originId: z.coerce.number().int().min(1).optional(),
    search: z
      .string()
      .min(1, 'Search term must be between 1 and 100 characters')
      .max(100, 'Search term must be between 1 and 100 characters')
      .optional(),
    sortBy: z.enum(FLIGHT_SORT_FIELDS).default('departure'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .refine(
    (q) =>
      !q.departureFrom ||
      !q.departureTo ||
      new Date(q.departureTo).getTime() >= new Date(q.departureFrom).getTime(),
    {
      error: 'departureTo must be on or after departureFrom',
      path: ['departureTo'],
    },
  )
  .refine(
    (q) =>
      q.minPrice === undefined ||
      q.maxPrice === undefined ||
      q.maxPrice >= q.minPrice,
    {
      error: 'Maximum price must be greater than or equal to minimum price',
      path: ['maxPrice'],
    },
  );

export type CreateFlightBody = z.infer<typeof createFlightSchema>;
export type FlightListQuery = z.infer<typeof flightListQuery>;
export type FlightStatusBody = z.infer<typeof flightStatusSchema>;
export type UpdateFlightBody = z.infer<typeof updateFlightSchema>;
