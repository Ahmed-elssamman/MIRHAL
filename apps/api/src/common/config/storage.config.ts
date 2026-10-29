import { registerAs } from '@nestjs/config';
import { resolve } from 'node:path';

export interface StorageConfig {
  uploadDir: string;
  blobToken?: string;
  isVercel: boolean;
}

export const storageConfig = registerAs('storage', (): StorageConfig => {
  return {
    uploadDir: resolve(process.env['UPLOAD_DIR'] ?? '.local/uploads'),
    blobToken: process.env['BLOB_READ_WRITE_TOKEN'],
    isVercel: process.env['VERCEL'] === '1',
  };
});
