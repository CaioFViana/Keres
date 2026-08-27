/**
 * @jest-environment node
 */
import type { ChapterRelationType } from '@keres/shared';
import { readFromPerspective } from '../../src/components/features/chapters/ChronologyManager/ChronologyManager';

/**
 * The same statement, read from either end.
 *
 * One row says "the war before chapter 4". On the war's screen that reads "happened before Chapter
 * 4"; on chapter 4's it has to read "happened after The war". Same row, said from where the reader
 * is standing.
 *
 * This is worth its own test because getting it wrong is invisible in review and catastrophic in
 * meaning: half the chronology in the app would read as the exact opposite of what the writer
 * stated, and nothing would look broken.
 */

const relation = (relationType: ChapterRelationType) => ({
  id: 'r1',
  chapter1Id: 'war',
  chapter2Id: 'chapter-4',
  relationType,
});

describe('reading a directional statement', () => {
  it('reads forwards from the container that is its subject', () => {
    expect(readFromPerspective(relation('before'), 'war')).toEqual({
      otherId: 'chapter-4',
      phraseKey: 'chronology_type_before',
    });
  });

  it('turns it around from the other end', () => {
    expect(readFromPerspective(relation('before'), 'chapter-4')).toEqual({
      otherId: 'war',
      phraseKey: 'chronology_type_after',
    });
  });

  /** Containment reverses into its own word, not into "after": the shape is different. */
  it('reads during as contains from the other end', () => {
    expect(readFromPerspective(relation('during'), 'war').phraseKey).toBe('chronology_type_during');
    expect(readFromPerspective(relation('during'), 'chapter-4').phraseKey).toBe(
      'chronology_type_contains',
    );
  });
});

describe('reading an unordered statement', () => {
  it.each(['overlaps', 'simultaneous'] as const)('reads %s the same either way', (relationType) => {
    const forwards = readFromPerspective(relation(relationType), 'war');
    const backwards = readFromPerspective(relation(relationType), 'chapter-4');

    expect(forwards.phraseKey).toBe(`chronology_type_${relationType}`);
    expect(backwards.phraseKey).toBe(forwards.phraseKey);
  });

  it('still names the other end correctly', () => {
    expect(readFromPerspective(relation('overlaps'), 'war').otherId).toBe('chapter-4');
    expect(readFromPerspective(relation('overlaps'), 'chapter-4').otherId).toBe('war');
  });
});

/**
 * Every relation type has a reading from both ends.
 *
 * A type added to the enum without one here would fall through to `undefined` and render a raw key
 * on screen - the kind of gap a `Record` catches at compile time only if somebody remembers to keep
 * it exhaustive.
 */
describe('every type is readable', () => {
  it.each(['before', 'during', 'overlaps', 'simultaneous'] as const)(
    'has a phrase for %s in both directions',
    (relationType) => {
      expect(readFromPerspective(relation(relationType), 'war').phraseKey).toBeTruthy();
      expect(readFromPerspective(relation(relationType), 'chapter-4').phraseKey).toBeTruthy();
    },
  );
});
