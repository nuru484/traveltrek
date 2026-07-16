// src/middlewares/conditional-cloudinary-upload.ts
import { NextFunction, Request, Response } from 'express';

import { handleCloudinaryUpload } from '#middlewares/handle-cloudinary-upload.js';

const conditionalCloudinaryUpload = (
  options: Parameters<typeof handleCloudinaryUpload>[0],
  fieldName: string,
) => {
  const uploadMiddleware = handleCloudinaryUpload(options, fieldName);

  return (req: Request, res: Response, next: NextFunction) => {
    const hasFile =
      req.file !== undefined ||
      (Array.isArray(req.files) && req.files.length > 0) ||
      (req.files &&
        typeof req.files === 'object' &&
        fieldName in req.files &&
        Array.isArray(
          (req.files as Record<string, Express.Multer.File[]>)[fieldName],
        ) &&
        (req.files as Record<string, Express.Multer.File[]>)[fieldName].length >
          0); // for .fields()

    if (hasFile) {
      return uploadMiddleware(req, res, next);
    } else {
      next();
      return;
    }
  };
};

export default conditionalCloudinaryUpload;
