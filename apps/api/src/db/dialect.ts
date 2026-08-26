/**
 * Which database this API is using.
 *
 * `sqlite` exists for the home-grown Keres Server (one process, no Docker). It is not the dialect of a
 * public API with several instances - that is still Postgres.
 *
 * Read straight from the environment rather than from `config/env.ts`, because the schema
 * (`db/schema/**`) imports this module and drizzle-kit loads the schema outside the API's process -
 * there, `env.ts` and its validations of JWT, S3 and the like have no way of being satisfied. The
 * dialect choice is the only thing the schema needs to know, and it is a single string.
 */

export type DatabaseDriver = 'postgres' | 'sqlite';

export const DATABASE_DRIVER: DatabaseDriver =
  process.env.DATABASE_DRIVER === 'sqlite' ? 'sqlite' : 'postgres';

export const usingSqlite = DATABASE_DRIVER === 'sqlite';
