/**
 * The app's one way to write a diagnostic line. Nothing under `src/` calls `console` directly
 * (`test/architecture/noDirectConsole.test.ts` keeps it so), which gives the app a single place to
 * decide what is shown, where it goes, and what a release build keeps quiet.
 *
 * - `debug`: progress chatter that helps while developing (what is initializing, what was found). Silent
 *   in a release build.
 * - `warn`: something unexpected that the app recovered from.
 * - `error`: something failed. Always written.
 *
 * Each call reads `console` at the moment it is made, so a test that spies on `console.error` still sees it.
 */

const isDevelopment = () => (typeof __DEV__ === 'undefined' ? true : __DEV__);

export const logger = {
  debug: (...args: unknown[]): void => {
    if (isDevelopment()) console.log(...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
