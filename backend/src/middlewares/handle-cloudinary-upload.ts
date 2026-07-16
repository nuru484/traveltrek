// src/middlewares/handle-cloudinary-upload.ts
import { NextFunction, Request, Response } from 'express';
import { ICloudinaryUploadOptions } from 'types/cloudinary.types';

import { cloudinaryService } from '../config/claudinary';
import { isValidBase64Image } from '../utils/validate-base64-image';
import { asyncHandler, ValidationError } from './error-handler';

// Custom request interface that extends Express Request
interface MulterRequest extends Request {
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | Record<string, Express.Multer.File[]>;
}

/**
 * Factory function to create middleware for handling file uploads to Cloudinary
 * @param defaultOptions - Default Cloudinary upload options
 * @param uploadedResultsName - The key to store upload results in req.body
 * @returns Express middleware
 */
export const handleCloudinaryUpload = (
  defaultOptions: Partial<ICloudinaryUploadOptions> = {},
  uploadedResultsName: string,
) => {
  return asyncHandler(
    async (req: MulterRequest, res: Response, next: NextFunction) => {
      try {
        // express.json() types req.body as any; narrow it once
        const body = req.body as Record<string, unknown>;

        // Merge defaultOptions with any options provided in req.body
        const bodyOptions =
          typeof body.uploadOptions === 'object' && body.uploadOptions !== null
            ? (body.uploadOptions as Partial<ICloudinaryUploadOptions>)
            : {};
        const options: Partial<ICloudinaryUploadOptions> = {
          ...defaultOptions,
          ...bodyOptions,
        };

        // Case 1: Single file upload
        if (req.file) {
          const result = await cloudinaryService.uploadImage(
            { ...req.file },
            options,
          );
          body[uploadedResultsName] = result.secure_url;
          next();
          return;
        }

        // Case 2: Multiple file uploads as array
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          const results = await Promise.all(
            req.files.map((file) =>
              cloudinaryService.uploadImage({ ...file }, options),
            ),
          );
          body[uploadedResultsName] = results.map(
            (result) => result.secure_url,
          );
          next();
          return;
        }

        // Case 3: Multiple file uploads as object (for fields)
        if (req.files && !Array.isArray(req.files)) {
          const results: Record<string, string[]> = {};

          for (const fieldname in req.files) {
            const fieldFiles = req.files[fieldname];
            if (Array.isArray(fieldFiles) && fieldFiles.length > 0) {
              const uploaded = await Promise.all(
                fieldFiles.map((file) =>
                  cloudinaryService.uploadImage({ ...file }, options),
                ),
              );
              results[fieldname] = uploaded.map((result) => result.secure_url);
            }
          }

          if (Object.keys(results).length > 0) {
            body[uploadedResultsName] = results;
            next();
            return;
          }
        }

        // Case 4: Base64 image upload
        if (typeof body.image === 'string' && isValidBase64Image(body.image)) {
          const result = await cloudinaryService.uploadImage(
            body.image,
            options,
          );
          body[uploadedResultsName] = result.secure_url;
          next();
          return;
        }

        // No valid files found
        next(new ValidationError('No valid files found for upload'));
        return;
      } catch (error) {
        next(error);
        return;
      }
    },
  );
};
