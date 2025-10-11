import { query } from 'express-validator';

export const monthlyBookingsValidation = [
  query('year')
    .optional()
    .isInt({ min: 2020, max: 2030 })
    .withMessage('Year must be between 2020 and 2030'),
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('tourId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Tour ID must be a positive integer'),
  query('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  query('status')
    .optional()
    .isIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'])
    .withMessage('Invalid booking status'),
];

export const paymentsSummaryValidation = [
  query('year')
    .optional()
    .isInt({ min: 2020, max: 2030 })
    .withMessage('Year must be between 2020 and 2030'),
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('paymentMethod')
    .optional()
    .isIn(['CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'])
    .withMessage('Invalid payment method'),
  query('status')
    .optional()
    .isIn(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'])
    .withMessage('Invalid payment status'),
  query('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  query('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter code'),
];

export const topToursValidation = [
  query('year')
    .optional()
    .isInt({ min: 2020, max: 2030 })
    .withMessage('Year must be between 2020 and 2030'),
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('tourType')
    .optional()
    .isIn(['ADVENTURE', 'CULTURAL', 'BEACH', 'CITY', 'WILDLIFE', 'CRUISE'])
    .withMessage('Invalid tour type'),
  query('tourStatus')
    .optional()
    .isIn(['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'])
    .withMessage('Invalid tour status'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1 and 20'),
  query('minBookings')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum bookings must be non-negative'),
];
