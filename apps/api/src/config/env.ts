import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '../../.env' });

const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_SECRET_REFRESH: z.string().min(32, 'JWT_SECRET_REFRESH must be at least 32 characters long'),
  PORT: z.string().optional().default('3000'),
  SERVER_VERSION: z.string().optional().default('1.0.0'),
  NODE_ENV: z.string().optional().default("development")
});

export const env = envSchema.parse(process.env);
