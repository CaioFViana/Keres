import {
  compareNarrativeScenes,
  sortScenesNarratively,
  UNCHAPTERED_GROUP_ID,
  isUnchapteredGroup,
} from '../../src/utils/narrativeSceneOrder';

const scene = (name: string, chapterId: string | null, index: number) =>
  ({ name, chapterId, index }) as any;

describe('narrative scene order', () => {
  const chapters = [
    { id: 'late', index: 2 },
    { id: 'early', index: 1 },
  ] as never;

  it('orders scenes by their chapter spine and then by local index', () => {
    expect(
      sortScenesNarratively(
        [
          scene('late two', 'late', 2),
          scene('early two', 'early', 2),
          scene('early one', 'early', 1),
          scene('late one', 'late', 1),
        ],
        chapters,
      ).map((entry) => entry.name),
    ).toEqual(['early one', 'early two', 'late one', 'late two']);
  });

  it('keeps unchaptered or orphaned scenes visible after the spine in stable name order', () => {
    expect(
      sortScenesNarratively(
        [
          scene('Zulu fragment', null, 99),
          scene('Known', 'early', 1),
          scene('Alpha fragment', null, 1),
          scene('Missing chapter', 'gone', 1),
        ],
        chapters,
      ).map((entry) => entry.name),
    ).toEqual(['Known', 'Alpha fragment', 'Missing chapter', 'Zulu fragment']);
  });

  it('never mutates the caller array and identifies only the synthetic unchaptered bucket', () => {
    const source = [scene('B', null, 1), scene('A', null, 2)];
    expect(sortScenesNarratively(source, chapters)).not.toBe(source);
    expect(source.map((entry) => entry.name)).toEqual(['B', 'A']);
    expect(isUnchapteredGroup(UNCHAPTERED_GROUP_ID)).toBe(true);
    expect(isUnchapteredGroup(null)).toBe(false);
    expect(compareNarrativeScenes(chapters)(scene('A', null, 1), scene('B', null, 2))).toBeLessThan(
      0,
    );
  });
});
