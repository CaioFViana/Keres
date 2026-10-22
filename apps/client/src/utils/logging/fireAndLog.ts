import { logger } from './logger';

/**
 * Starts work nobody will wait for - a refresh, a save kicked off by a gesture - and makes sure a
 * failure is heard: a rejected promise is logged with what it was doing instead of vanishing.
 * Anything that is not a promise (a handler that returned nothing) is ignored.
 */
export function fireAndLog(work: unknown, what: string): void {
  if (work instanceof Promise) {
    work.catch((error) => logger.error(`${what} failed:`, error));
  }
}
