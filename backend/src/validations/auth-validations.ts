import { ValidationChain } from 'express-validator';

// src/validations/auth-validations.ts
import { validator } from '#validations/validation-factory.js';

// Validator for creating a new user
export const registerUserValidation: ValidationChain[] = [
  validator.string('name', {
    customMessage: 'Name can only be a string up to 100 characters',
    maxLength: 100,
    required: true,
  }),
  validator.password('password', {
    customMessage: 'Password must be a strong password',
    maxLength: 255,
    minLength: 4,
    required: true,
  }),

  validator.string('address', {
    customMessage: 'Address must be a string up to 100 characters',
    maxLength: 100,
    required: true,
  }),
  validator.phone('phone', {
    customMessage: 'Phone must be a valid phone number (10-15 digits)',
    pattern: /^\+?[0-9]{10,15}$/,
    required: false,
  }),
];
