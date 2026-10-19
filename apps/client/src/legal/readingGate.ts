/**
 * The least time, in seconds, a text that must be agreed to has to stay open before "I agree" works.
 *
 * Scrolling to the end alone proves nothing on a tall window - the whole text fits and nothing needs scrolling - or for
 * a finger that flicks to the bottom. A text no one stays with for a few seconds was not read. Counted only while the
 * text is on screen, and kept if it is closed and opened again. Tests set it to 0 (see `test/jest.setup.ts`); the
 * suites of the gate itself bring it back.
 */
export const MIN_READ_SECONDS = 12;
