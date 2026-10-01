/** @jest-environment node */
import {
  defaultFirstStoryProgress,
  defaultTutorialProgress,
  encodeTutorialProgress,
  parseTutorialProgress,
  shouldCompleteFirstStory,
  TUTORIAL_PROGRESS_VERSION,
  withFirstStoryProgress,
  withTutorialSeen,
} from '../../src/utils/tutorialProgress';

describe('parseTutorialProgress', () => {
  it('reads the seen ids in first-seen order', () => {
    expect(
      parseTutorialProgress('{"version":1,"seen":["StorySelectionMain","MainDashboard"]}'),
    ).toEqual({ version: 1, seen: ['StorySelectionMain', 'MainDashboard'] });
  });

  it.each([undefined, null, 42, '', '   ', 'not-json', '[]', '"seen"', '42'])(
    'degrades garbage (%p) to the default',
    (raw) => {
      expect(parseTutorialProgress(raw)).toEqual(defaultTutorialProgress());
    },
  );

  it('drops non-string and empty entries', () => {
    expect(parseTutorialProgress('{"version":1,"seen":["A",42,null,"","B","A"]}')).toEqual({
      version: 1,
      seen: ['A', 'B'],
    });
  });

  it('resets when the version is unknown, so redesigned tours show again', () => {
    expect(parseTutorialProgress('{"version":999,"seen":["A"]}')).toEqual(
      defaultTutorialProgress(),
    );
    expect(parseTutorialProgress('{"seen":["A"]}')).toEqual(defaultTutorialProgress());
  });
});

describe('encodeTutorialProgress', () => {
  it('round-trips through parse', () => {
    const progress = { version: TUTORIAL_PROGRESS_VERSION, seen: ['A', 'B'] };

    expect(parseTutorialProgress(encodeTutorialProgress(progress))).toEqual(progress);
  });

  it('carries the trail when one is in progress', () => {
    const progress = withFirstStoryProgress({ version: 1, seen: ['A'] }, { choice: 'create' });

    expect(parseTutorialProgress(encodeTutorialProgress(progress))).toEqual({
      version: 1,
      seen: ['A'],
      firstStory: { choice: 'create', done: false, dismissed: false },
    });
  });
});

describe('first story trail', () => {
  it('parses a stored trail', () => {
    expect(
      parseTutorialProgress(
        '{"version":1,"seen":[],"firstStory":{"choice":"example","done":false,"dismissed":false}}',
      ).firstStory,
    ).toEqual({ choice: 'example', done: false, dismissed: false });
  });

  it('drops a malformed trail but keeps the seen list', () => {
    expect(
      parseTutorialProgress('{"version":1,"seen":["A"],"firstStory":{"choice":"zzz"}}'),
    ).toEqual({ version: 1, seen: ['A'] });
  });

  it('merges trail updates without touching the seen list', () => {
    const progress = withFirstStoryProgress({ version: 1, seen: ['A'] }, { dismissed: true });

    expect(progress).toEqual({
      version: 1,
      seen: ['A'],
      firstStory: { ...defaultFirstStoryProgress(), dismissed: true },
    });
    expect(withFirstStoryProgress(progress, { done: true }).firstStory?.done).toBe(true);
  });

  it('keeps the trail across seen writes', () => {
    const progress = withFirstStoryProgress({ version: 1, seen: [] }, { choice: 'create' });

    expect(withTutorialSeen(progress, 'A')).toEqual({
      version: 1,
      seen: ['A'],
      firstStory: { choice: 'create', done: false, dismissed: false },
    });
  });
});

describe('shouldCompleteFirstStory', () => {
  it('completes only a chosen, unfinished, undismissed trail', () => {
    expect(shouldCompleteFirstStory({ version: 1, seen: [] })).toBe(false);
    const chosen = withFirstStoryProgress({ version: 1, seen: [] }, { choice: 'create' });
    expect(shouldCompleteFirstStory(chosen)).toBe(true);
    expect(shouldCompleteFirstStory(withFirstStoryProgress(chosen, { done: true }))).toBe(false);
    expect(shouldCompleteFirstStory(withFirstStoryProgress(chosen, { dismissed: true }))).toBe(
      false,
    );
  });
});

describe('withTutorialSeen', () => {
  it('appends a new id', () => {
    expect(withTutorialSeen({ version: 1, seen: ['A'] }, 'B')).toEqual({
      version: 1,
      seen: ['A', 'B'],
    });
  });

  it('returns the input untouched when the id is already seen', () => {
    const progress = { version: 1, seen: ['A'] };

    expect(withTutorialSeen(progress, 'A')).toBe(progress);
  });
});
