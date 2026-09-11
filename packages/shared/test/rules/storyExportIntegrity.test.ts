import { describe, expect, it } from 'vitest';
import {
  assertStoryExportIntegrity,
  findStoryExportIntegrityErrors,
  findStoryExportIntegrityViolations,
  pruneDanglingStoryExportRows,
  StoryIntegrityError,
} from '../../rules/storyExportIntegrity';

/**
 * The check that should have existed before the bundled example stories shipped with the same
 * character relation twice: valid rows, valid schema, and a graph drawing one pair as two.
 */

/** The minimum a story export needs for these rules to have something to look at. */
const buildExport = (overrides: Record<string, unknown> = {}) => ({
  story: { id: 'story-1', title: 'Test', type: 'linear' },
  characters: [
    { id: 'char-a', storyId: 'story-1', name: 'A' },
    { id: 'char-b', storyId: 'story-1', name: 'B' },
    { id: 'char-c', storyId: 'story-1', name: 'C' },
  ],
  chapters: [{ id: 'chapter-1', storyId: 'story-1', name: 'One' }],
  locations: [
    { id: 'loc-a', storyId: 'story-1', name: 'A' },
    { id: 'loc-b', storyId: 'story-1', name: 'B' },
  ],
  scenes: [
    {
      id: 'scene-1',
      storyId: 'story-1',
      chapterId: 'chapter-1',
      locationId: 'loc-a',
    },
    {
      id: 'scene-2',
      storyId: 'story-1',
      chapterId: 'chapter-1',
      locationId: 'loc-b',
    },
  ],
  characterRelations: [],
  characterScenes: [],
  locationRelations: [],
  tags: [],
  tagRelations: [],
  suggestions: [],
  ...overrides,
});

const relation = (
  id: string,
  character1Id: string,
  character2Id: string,
  relationType: string,
) => ({
  id,
  storyId: 'story-1',
  character1Id,
  character2Id,
  relationType,
});

describe('story export integrity', () => {
  it('prunes required dangling references until cascaded rows are stable', () => {
    const pruned = pruneDanglingStoryExportRows(
      buildExport({
        characterScenes: [
          {
            id: 'presence-live',
            storyId: 'story-1',
            characterId: 'char-a',
            sceneId: 'scene-1',
          },
          {
            id: 'presence-dead',
            storyId: 'story-1',
            characterId: 'gone',
            sceneId: 'scene-1',
          },
        ],
        choices: [
          {
            id: 'choice-dead',
            storyId: 'story-1',
            sceneId: 'missing',
            nextSceneId: 'scene-1',
          },
        ],
        choiceCheckGroups: [{ id: 'group-dead', storyId: 'story-1', choiceId: 'choice-dead' }],
        choiceChecks: [{ id: 'check-dead', storyId: 'story-1', groupId: 'group-dead' }],
      }),
    );
    expect(pruned.characterScenes).toEqual([expect.objectContaining({ id: 'presence-live' })]);
    expect((pruned as any).choices).toEqual([]);
    expect((pruned as any).choiceCheckGroups).toEqual([]);
    expect((pruned as any).choiceChecks).toEqual([]);
  });
  it('accepts a story whose rows agree with one another', () => {
    expect(findStoryExportIntegrityViolations(buildExport())).toEqual([]);
  });

  it('refuses a chapter assigned to an Arc the package does not carry', () => {
    const violations = findStoryExportIntegrityErrors(
      buildExport({
        storyArcs: [{ id: 'arc-a', storyId: 'story-1' }],
        chapters: [
          {
            id: 'chapter-1',
            storyId: 'story-1',
            name: 'One',
            arcId: 'arc-missing',
          },
        ],
      }),
    );

    expect(violations).toMatchObject([
      {
        kind: 'dangling_reference',
        collection: 'chapters',
        ids: ['chapter-1'],
      },
    ]);
  });

  it('refuses the same pair of characters related twice', () => {
    const violations = findStoryExportIntegrityErrors(
      buildExport({
        characterRelations: [
          relation('rel-1', 'char-a', 'char-b', 'Trust'),
          relation('rel-2', 'char-a', 'char-b', 'Trust'),
        ],
      }),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      severity: 'error',
      kind: 'duplicate_unique',
      collection: 'characterRelations',
      ids: ['rel-2'],
    });
  });

  /**
   * The hole PostgreSQL cannot see: its unique constraint is on the ordered pair, and the import path
   * inserts the ids in whatever order the file had them.
   */
  it('refuses the same pair reversed, and whatever the relation type says', () => {
    const violations = findStoryExportIntegrityErrors(
      buildExport({
        characterRelations: [
          relation('rel-1', 'char-a', 'char-b', 'Trust'),
          relation('rel-2', 'char-b', 'char-a', 'Rivalry'),
        ],
      }),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].ids).toEqual(['rel-2']);
  });

  it('accepts distinct pairs among the same characters', () => {
    expect(
      findStoryExportIntegrityErrors(
        buildExport({
          characterRelations: [
            relation('rel-1', 'char-a', 'char-b', 'Trust'),
            relation('rel-2', 'char-b', 'char-c', 'Rivalry'),
            relation('rel-3', 'char-a', 'char-c', 'Debt'),
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('refuses a character related to itself', () => {
    const violations = findStoryExportIntegrityErrors(
      buildExport({
        characterRelations: [relation('rel-1', 'char-a', 'char-a', 'Trust')],
      }),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      kind: 'self_relation',
      ids: ['rel-1'],
    });
  });

  /** Two places can both contain and connect to one another; they cannot contain one another twice. */
  it('scopes duplicate location relations by type', () => {
    const locationRelation = (id: string, a: string, b: string, relationType: string) => ({
      id,
      storyId: 'story-1',
      locationAId: a,
      locationBId: b,
      relationType,
    });

    expect(
      findStoryExportIntegrityErrors(
        buildExport({
          locationRelations: [
            locationRelation('lr-1', 'loc-a', 'loc-b', 'contains'),
            locationRelation('lr-2', 'loc-a', 'loc-b', 'connected_to'),
          ],
        }),
      ),
    ).toEqual([]);

    expect(
      findStoryExportIntegrityErrors(
        buildExport({
          locationRelations: [
            locationRelation('lr-1', 'loc-a', 'loc-b', 'contains'),
            locationRelation('lr-2', 'loc-b', 'loc-a', 'contains'),
          ],
        }),
      ),
    ).toHaveLength(1);
  });

  it('refuses a reference to an entity the file does not carry', () => {
    const violations = findStoryExportIntegrityErrors(
      buildExport({
        characterRelations: [relation('rel-1', 'char-a', 'char-missing', 'Trust')],
      }),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      kind: 'dangling_reference',
      collection: 'characterRelations',
      ids: ['rel-1'],
    });
  });

  it('refuses an id reused by another collection', () => {
    const violations = findStoryExportIntegrityErrors(
      buildExport({
        tags: [{ id: 'char-a', storyId: 'story-1', name: 'Clash' }],
      }),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      kind: 'duplicate_id',
      ids: ['char-a'],
    });
  });

  it('refuses a row belonging to another story', () => {
    const violations = findStoryExportIntegrityErrors(
      buildExport({
        tags: [{ id: 'tag-1', storyId: 'story-2', name: 'Stray' }],
      }),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      kind: 'foreign_story',
      ids: ['tag-1'],
    });
  });

  /**
   * A character listed twice in the same scene has no constraint behind it, so it must not block an
   * import - the story analysis is where the writer sees it.
   */
  it('reports a duplicate with no constraint behind it as a warning, not an error', () => {
    const story = buildExport({
      characterScenes: [
        {
          id: 'cs-1',
          storyId: 'story-1',
          characterId: 'char-a',
          sceneId: 'scene-1',
        },
        {
          id: 'cs-2',
          storyId: 'story-1',
          characterId: 'char-a',
          sceneId: 'scene-1',
        },
      ],
    });

    expect(findStoryExportIntegrityViolations(story)).toHaveLength(1);
    expect(findStoryExportIntegrityViolations(story)[0].severity).toBe('warning');
    expect(findStoryExportIntegrityErrors(story)).toEqual([]);
  });

  it('throws only on errors, carrying them on the exception', () => {
    expect(() => assertStoryExportIntegrity(buildExport())).not.toThrow();

    const corrupt = buildExport({
      characterRelations: [
        relation('rel-1', 'char-a', 'char-b', 'Trust'),
        relation('rel-2', 'char-a', 'char-b', 'Trust'),
      ],
    });
    expect(() => assertStoryExportIntegrity(corrupt)).toThrow(StoryIntegrityError);
    try {
      assertStoryExportIntegrity(corrupt);
    } catch (error) {
      expect((error as StoryIntegrityError).violations[0].ids).toEqual(['rel-2']);
    }
  });
});
