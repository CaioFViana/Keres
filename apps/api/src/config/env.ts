import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '../../.env' });

const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_SECRET_REFRESH: z.string().min(32, 'JWT_SECRET_REFRESH must be at least 32 characters long'),
  PORT: z.string().optional().default('3000'),
  SERVER_VERSION: z.string().optional().default('1.0.0'),
  NODE_ENV: z.string().optional().default("development"),
  /** Raiz onde os arquivos de mídia da galeria são gravados (endereçados por hash). */
  MEDIA_STORAGE_PATH: z.string().optional().default('./media-storage'),
  /** Teto por arquivo. Vídeo de celular passa fácil de 20 MB, daí o padrão de 50 MB. */
  MEDIA_MAX_BYTES: z.coerce.number().int().positive().optional().default(50 * 1024 * 1024),
});

export const env = envSchema.parse(process.env);
