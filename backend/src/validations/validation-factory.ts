// validations/validation-factory.ts.ts
import { body, ValidationChain } from 'express-validator';

export interface ArrayValidationOptions extends BaseValidationOptions {
  itemType?: 'boolean' | 'number' | 'object' | 'string';
  maxLength?: number;
  minLength?: number;
  unique?: boolean;
}

// Define common validation options
export interface BaseValidationOptions {
  required?: boolean;
}

export interface DateValidationOptions extends BaseValidationOptions {
  compareDateField?: string;
  compareDateOperation?:
    | 'after'
    | 'after-or-same'
    | 'before'
    | 'before-or-same'
    | 'same';
  maxDate?: Date;
  minDate?: Date;
}

export interface EmailValidationOptions extends StringValidationOptions {
  allowDomains?: string[];
  blockDomains?: string[];
}

export interface NumberValidationOptions extends BaseValidationOptions {
  allowDecimals?: boolean;
  max?: number;
  min?: number;
}

export interface ObjectValidationOptions extends BaseValidationOptions {
  allowEmpty?: boolean;
  requiredFields?: string[];
}

export interface PasswordValidationOptions extends StringValidationOptions {
  confirmField?: string;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  requireUppercase?: boolean;
}

export interface StringValidationOptions extends BaseValidationOptions {
  customMessage?: string;
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
}

class ValidationFactory {
  /**
   * Validates an array input
   * @param fieldName - The name of the field to validate
   * @param options - Validation options for the array
   */
  array(
    fieldName: string,
    options: ArrayValidationOptions = {},
  ): ValidationChain {
    const {
      itemType,
      maxLength,
      minLength,
      required = true,
      unique = false,
    } = options;

    const validation = body(fieldName, `${fieldName} must be an array`);

    if (required) {
      validation.notEmpty().withMessage(`${fieldName} is required`);
    } else {
      validation.optional();
    }

    validation.isArray().withMessage(`${fieldName} must be an array`);

    if (minLength !== undefined) {
      validation
        .custom((array: any[]) => array.length >= minLength)
        .withMessage(`${fieldName} must contain at least ${minLength} item(s)`);
    }

    if (maxLength !== undefined) {
      validation
        .custom((array: any[]) => array.length <= maxLength)
        .withMessage(`${fieldName} must contain at most ${maxLength} item(s)`);
    }

    if (unique) {
      validation
        .custom((array: any[]) => {
          const uniqueItems = new Set(
            array.map((item) => JSON.stringify(item)),
          );
          return uniqueItems.size === array.length;
        })
        .withMessage(`${fieldName} must contain unique items`);
    }

    if (itemType) {
      validation
        .custom((array: any[]) => {
          return array.every((item) => {
            switch (itemType) {
              case 'boolean':
                return typeof item === 'boolean';
              case 'number':
                return typeof item === 'number';
              case 'object':
                return typeof item === 'object' && item !== null;
              case 'string':
                return typeof item === 'string';
              default:
                return true;
            }
          });
        })
        .withMessage(`All items in ${fieldName} must be of type ${itemType}`);
    }

    return validation;
  }

  /**
   * Validates a boolean input
   * @param fieldName - The name of the field to validate
   * @param options - Validation options for the boolean
   */
  boolean(
    fieldName: string,
    options: BaseValidationOptions = {},
  ): ValidationChain {
    const { required = true } = options;

    const validation = body(fieldName, `${fieldName} must be a boolean`);

    if (required) {
      validation.notEmpty().withMessage(`${fieldName} is required`);
    } else {
      validation.optional();
    }

    validation.isBoolean().withMessage(`${fieldName} must be a boolean value`);

    return validation;
  }

  /**
   * Validates a password confirmation
   * @param confirmFieldName - The name of the confirmation field
   * @param passwordFieldName - The name of the password field to compare against
   */
  confirmPassword(
    confirmFieldName = 'confirmPassword',
    passwordFieldName = 'password',
  ): ValidationChain {
    return body(confirmFieldName)
      .exists({ checkFalsy: true })
      .withMessage('Password confirmation is required')
      .custom((value: string, { req }) => value === req.body[passwordFieldName])
      .withMessage('Passwords do not match');
  }

  /**
   * Creates a custom validator with a user-defined validation function
   * @param fieldName - The name of the field to validate
   * @param validationFn - Custom validation function
   * @param errorMessage - Error message to display on validation failure
   * @param options - Base validation options
   */
  custom(
    fieldName: string,
    validationFn: (value: any, req: any) => boolean | Promise<boolean>,
    errorMessage: string,
    options: BaseValidationOptions = {},
  ): ValidationChain {
    const { required = true } = options;

    const validation = body(fieldName);

    if (required) {
      validation.notEmpty().withMessage(`${fieldName} is required`);
    } else {
      validation.optional();
    }

    validation.custom(async (value, { req }) => {
      const result = await validationFn(value, req);
      if (!result) {
        throw new Error(errorMessage);
      }
      return true;
    });

    return validation;
  }

  /**
   * Validates a date input
   * @param fieldName - The name of the field to validate
   * @param options - Validation options for the date
   */
  date(
    fieldName: string,
    options: DateValidationOptions = {},
  ): ValidationChain {
    const {
      compareDateField,
      compareDateOperation,
      maxDate,
      minDate,
      required = true,
    } = options;

    const validation = body(fieldName, `${fieldName} must be a valid date`);

    if (required) {
      validation.notEmpty().withMessage(`${fieldName} is required`);
    } else {
      validation.optional();
    }

    validation
      .isISO8601()
      .toDate()
      .withMessage(`${fieldName} must be a valid date`);

    if (minDate) {
      validation.custom((value: Date) => {
        if (!value) return true;
        if (value < minDate) {
          throw new Error(
            `${fieldName} must be on or after ${
              minDate.toISOString().split('T')[0]
            }`,
          );
        }
        return true;
      });
    }

    if (maxDate) {
      validation.custom((value: Date) => {
        if (!value) return true;
        if (value > maxDate) {
          throw new Error(
            `${fieldName} must be on or before ${
              maxDate.toISOString().split('T')[0]
            }`,
          );
        }
        return true;
      });
    }

    if (compareDateField && compareDateOperation) {
      validation.custom((value: Date, { req }) => {
        if (!value) return true;

        const compareDate = req.body[compareDateField]
          ? new Date(req.body[compareDateField])
          : null;

        if (!compareDate) return true;

        switch (compareDateOperation) {
          case 'after':
            if (value <= compareDate) {
              throw new Error(`${fieldName} must be after ${compareDateField}`);
            }
            break;
          case 'after-or-same':
            if (value < compareDate) {
              throw new Error(
                `${fieldName} must be after or the same as ${compareDateField}`,
              );
            }
            break;
          case 'before':
            if (value >= compareDate) {
              throw new Error(
                `${fieldName} must be before ${compareDateField}`,
              );
            }
            break;
          case 'before-or-same':
            if (value > compareDate) {
              throw new Error(
                `${fieldName} must be before or the same as ${compareDateField}`,
              );
            }
            break;
          case 'same':
            if (value.getTime() !== compareDate.getTime()) {
              throw new Error(
                `${fieldName} must be the same as ${compareDateField}`,
              );
            }
            break;
        }

        return true;
      });
    }

    return validation;
  }

  /**
   * Validates an email input
   * @param fieldName - The name of the field to validate
   * @param options - Validation options for the email
   */
  email(
    fieldName: string,
    options: EmailValidationOptions = {},
  ): ValidationChain {
    const {
      allowDomains,
      blockDomains,
      maxLength = 255,
      required = true,
    } = options;

    const validation = this.string(fieldName, { maxLength, required })
      .isEmail()
      .withMessage('Invalid email address')
      .normalizeEmail();

    if (allowDomains?.length) {
      validation.custom((email: string) => {
        if (!email) return true;

        const domain = email.split('@')[1];
        if (!allowDomains.includes(domain)) {
          throw new Error(`Email domain ${domain} is not allowed`);
        }
        return true;
      });
    }

    if (blockDomains?.length) {
      validation.custom((email: string) => {
        if (!email) return true;

        const domain = email.split('@')[1];
        if (blockDomains.includes(domain)) {
          throw new Error(`Email domain ${domain} is not allowed`);
        }
        return true;
      });
    }

    return validation;
  }

  /**
   * Validates an enum input
   * @param fieldName - The name of the field to validate
   * @param allowedValues - Array of allowed values
   * @param options - Base validation options
   */
  enum(
    fieldName: string,
    allowedValues: unknown[],
    options: BaseValidationOptions = {},
  ): ValidationChain {
    const { required = true } = options;

    const validation = body(fieldName);

    if (required) {
      validation.notEmpty().withMessage(`${fieldName} is required`);
    } else {
      validation.optional();
    }

    validation
      .custom((value: unknown) => allowedValues.includes(value))
      .withMessage(`${fieldName} must be one of: ${allowedValues.join(', ')}`);

    return validation;
  }

  /**
   * Validates an integer input
   * @param fieldName - The name of the field to validate
   * @param options - Validation options for the integer
   */
  integer(
    fieldName: string,
    options: NumberValidationOptions = {},
  ): ValidationChain {
    return this.number(fieldName, { ...options, allowDecimals: false });
  }

  /**
   * Validates a number input
   * @param fieldName - The name of the field to validate
   * @param options - Validation options for the number
   */
  number(
    fieldName: string,
    options: NumberValidationOptions = {},
  ): ValidationChain {
    const { allowDecimals = true, max, min, required = true } = options;

    const validation = body(fieldName, `${fieldName} must be a valid number`);

    if (required) {
      validation.notEmpty().withMessage(`${fieldName} is required`);
    } else {
      validation.optional();
    }

    if (allowDecimals) {
      validation.isFloat().withMessage(`${fieldName} must be a number`);
    } else {
      validation.isInt().withMessage(`${fieldName} must be an integer`);
    }

    if (min !== undefined) {
      validation
        .custom((value: number) => value >= min)
        .withMessage(`${fieldName} must be greater than or equal to ${min}`);
    }

    if (max !== undefined) {
      validation
        .custom((value: number) => value <= max)
        .withMessage(`${fieldName} must be less than or equal to ${max}`);
    }

    return validation;
  }

  /**
   * Validates an object input
   * @param fieldName - The name of the field to validate
   * @param options - Validation options for the object
   */
  object(
    fieldName: string,
    options: ObjectValidationOptions = {},
  ): ValidationChain {
    const {
      allowEmpty = false,
      required = true,
      requiredFields = [],
    } = options;

    const validation = body(fieldName, `${fieldName} must be an object`);

    if (required) {
      validation.notEmpty().withMessage(`${fieldName} is required`);
    } else {
      validation.optional();
    }

    validation.isObject().withMessage(`${fieldName} must be an object`).bail();

    if (!allowEmpty) {
      validation
        .custom((obj: Record<string, any>) => Object.keys(obj).length > 0)
        .withMessage(`${fieldName} cannot be empty`);
    }

    if (requiredFields.length > 0) {
      validation
        .custom((obj: Record<string, any>) => {
          return requiredFields.every(
            (field) =>
              Object.prototype.hasOwnProperty.call(obj, field) &&
              obj[field] !== null &&
              obj[field] !== undefined,
          );
        })
        .withMessage(
          `${fieldName} must include required fields: ${requiredFields.join(
            ', ',
          )}`,
        );
    }

    return validation;
  }

  /**
   * Validates a password
   * @param fieldName - The name of the field to validate
   * @param options - Validation options for the password
   */
  password(
    fieldName = 'password',
    options: PasswordValidationOptions = {},
  ): ValidationChain {
    const {
      maxLength = 255,
      minLength = 8,
      required = true,
      requireLowercase = false,
      requireNumbers = false,
      requireSpecialChars = false,
      requireUppercase = false,
    } = options;

    const validation = this.string(fieldName, {
      maxLength,
      minLength,
      required,
    }).withMessage(`Password must be at least ${minLength} characters long`);

    if (requireUppercase) {
      validation
        .matches(/[A-Z]/)
        .withMessage('Password must contain at least one uppercase letter');
    }

    if (requireLowercase) {
      validation
        .matches(/[a-z]/)
        .withMessage('Password must contain at least one lowercase letter');
    }

    if (requireNumbers) {
      validation
        .matches(/\d/)
        .withMessage('Password must contain at least one number');
    }

    if (requireSpecialChars) {
      validation
        .matches(/[@$!%*?&#]/)
        .withMessage('Password must contain at least one special character');
    }

    return validation;
  }

  /**
   * Validates a phone number input
   * @param fieldName - The name of the field to validate
   * @param options - Validation options for the phone number
   */
  phone(
    fieldName: string,
    options: StringValidationOptions = {},
  ): ValidationChain {
    const { pattern = /^\+?[0-9]{10,15}$/, required = true } = options;

    return this.string(fieldName, {
      customMessage: 'Must be a valid phone number (10–15 digits)',
      pattern,
      required,
    });
  }

  /**
   * Validates a string input
   * @param fieldName - The name of the field to validate
   * @param options - Validation options for the string
   */
  string(
    fieldName: string,
    options: StringValidationOptions = {},
  ): ValidationChain {
    const {
      customMessage,
      maxLength = 255,
      minLength,
      pattern,
      required = true,
    } = options;

    const errorMessage =
      customMessage || `${fieldName} must be a non-empty string`;
    const validation = body(fieldName, errorMessage).trim();

    if (required) {
      validation.notEmpty().withMessage(`${fieldName} is required`);
    } else {
      validation.optional();
    }

    if (minLength !== undefined) {
      validation
        .isLength({ min: minLength })
        .withMessage(
          `${fieldName} must be at least ${minLength} characters long`,
        );
    }

    validation
      .isLength({ max: maxLength })
      .withMessage(`${fieldName} must not exceed ${maxLength} characters`);

    if (pattern) {
      validation
        .matches(pattern)
        .withMessage(`${fieldName} does not match the required pattern`);
    }

    return validation;
  }

  /**
   * Validates a URL input
   * @param fieldName - The name of the field to validate
   * @param options - Validation options for the URL
   */
  url(
    fieldName: string,
    options: StringValidationOptions & { protocols?: string[] } = {},
  ): ValidationChain {
    const {
      maxLength = 2083,
      protocols = ['http', 'https'],
      required = true,
    } = options;

    const validation = this.string(fieldName, { maxLength, required })
      .isURL({ protocols })
      .withMessage(
        `${fieldName} must be a valid URL with protocols: ${protocols.join(
          ', ',
        )}`,
      );

    return validation;
  }

  /**
   * Validates a username input
   * @param fieldName - The name of the field to validate
   * @param options - Validation options for the username
   */
  username(
    fieldName: string,
    options: StringValidationOptions = {},
  ): ValidationChain {
    const {
      customMessage,
      maxLength = 100,
      minLength = 3,
      pattern = /^[a-zA-Z0-9_]+$/,
      required = true,
    } = options;

    return this.string(fieldName, {
      customMessage:
        customMessage ||
        'Username can only contain letters, numbers, and underscores',
      maxLength,
      minLength,
      pattern,
      required,
    });
  }
}

// Create and export a singleton instance
export const validator = new ValidationFactory();

// Export the factory class for extension if needed
export default ValidationFactory;
