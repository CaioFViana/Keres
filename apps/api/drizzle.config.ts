import * as dotenv from 'dotenv';
import type { Config } from 'drizzle-kit';
import { URL } from 'node:url';

dotenv.config({ path: './.env' });

const dbUrl = new URL(process.env.DATABASE_URL!);

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: dbUrl.hostname,
    port: Number(dbUrl.port),
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.substring(1), // Remove the leading '/'
    ssl: false,
  },
  verbose: true,
  strict: true,
} satisfies Config;
