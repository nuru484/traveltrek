// Constants for configuration
import { ICloudinaryUploadOptions } from 'types/cloudinary.types';

export const HTTP_STATUS_CODES = {
  BAD_REQUEST: 400,
  CONFLICT: 409,
  CREATED: 201,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
  NO_CONTENT: 204,
  NOT_FOUND: 404,
  OK: 200,
  UNAUTHORIZED: 401,
};

export const BCRYPT_SALT_ROUNDS = 10;

export const CLOUDINARY_UPLOAD_OPTIONS: Partial<ICloudinaryUploadOptions> = {
  allowedFormats: ['jpg', 'jpeg', 'png', 'gif'],
  folder: 'travel-and-tour-system',
};
