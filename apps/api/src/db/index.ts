import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import * as schema from './schema';

dotenv.config({ path: '../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// node-postgres emits 'error' on the pool when an idle client's connection dies
// (DB restart, network blip). Without a listener, that's an unhandled EventEmitter
// 'error' - Node throws it as an uncaught exception and kills the whole process.
pool.on('error', (error) => {
  logger.error('Postgres pool error on an idle client', error);
});

export const db = drizzle(pool, { schema, logger: false });
