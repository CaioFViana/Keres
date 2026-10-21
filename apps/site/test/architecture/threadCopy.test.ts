import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The thread is drawn by the same three files in the landing and in the showcase. The two apps share no package
 * (the landing depends on nothing of the repository's other packages, on purpose), so the copy is kept honest here:
 * a change made on one side and not on the other fails this.
 */
const SITE = resolve(__dirname, '../../src/components/thread');
const WEB = resolve(__dirname, '../../../web/src/showcase/components/thread');

describe('the thread files', () => {
  it.each(['thread.ts', 'ThreadPage.tsx', 'thread.css'])(
    '%s is the same in the showcase',
    (file) => {
      expect(readFileSync(resolve(WEB, file), 'utf8')).toBe(
        readFileSync(resolve(SITE, file), 'utf8'),
      );
    },
  );
});
