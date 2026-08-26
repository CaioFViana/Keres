/**
 * The same integration suite, running over a SQLite file.
 *
 * `DATABASE_DRIVER` is set here, before any module loads, for the same reason as
 * `drizzle.sqlite.config.ts`: the schema decides its dialect at import time. A config file rather than
 * a variable on the command line because `VAR=value command` does not work in PowerShell, and this has
 * to run the same on any machine.
 */
process.env.DATABASE_DRIVER = 'sqlite';

// eslint-disable-next-line import/first
import baseConfig from './vitest.integration.config';

export default baseConfig;
