import { TransformationOptions } from 'cloudinary';

/**
 * Interface for Cloudinary configuration
 */
export interface ICloudinaryConfig {
  api_key: string;
  api_secret: string;
  cloud_name: string;
}

/**
 * Interface for Cloudinary deletion response
 */
export interface ICloudinaryDeletionResponse {
  [key: string]: unknown;
  result: string;
}

/**
 * Interface for Cloudinary upload options
 */
export interface ICloudinaryUploadOptions {
  [key: string]: unknown;
  folder?: string;
  public_id?: string;
  resource_type: 'auto' | 'image' | 'raw' | 'video' | undefined;
  tags?: string[];
  transformation?: TransformationOptions;
}

/**
 * Interface for upload result
 */
export interface ICloudinaryUploadResult {
  asset_id?: string;
  format?: string;
  public_id: string;
  resource_type?: string;
  secure_url: string;
}

/**
 * Service interface for Cloudinary operations
 */
export interface ICloudinaryUploadService {
  deleteImage(publicId: string): Promise<ICloudinaryDeletionResponse>;
  uploadImage(
    image: IUploadedFile | string,
    options: Partial<ICloudinaryUploadOptions>,
  ): Promise<ICloudinaryUploadResult>;
}

/**
 * Interface for uploaded file metadata
 */
export interface IUploadedFile {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
  size?: number;
}
