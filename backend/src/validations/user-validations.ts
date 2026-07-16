import { ValidationChain } from 'express-validator';

// src/validations/user-validations.ts
import { validator } from './validation-factory';

// Validator for updating an existing user
export const updateUserProfileValidation: ValidationChain[] = [
  validator.string('name', {
    customMessage: 'Name must be a string up to 100 characters',
    maxLength: 100,
    required: false,
  }),
  validator.email('email', {
    maxLength: 255,
    required: false,
  }),
  validator.enum('role', ['ADMIN', 'CUSTOMER', 'AGENT'], {
    required: false,
  }),
  validator.string('address', {
    customMessage: 'Address must be a string up to only 100 characters',
    maxLength: 100,
    required: false,
  }),
  validator.phone('phone', {
    customMessage: 'Phone must be a valid phone number (10-15 digits)',
    pattern: /^\+?[0-9]{10,15}$/,
    required: false,
  }),
];
