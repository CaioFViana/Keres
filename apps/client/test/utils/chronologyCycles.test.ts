/**
 * @jest-environment node
 */
import {
  buildStoryAnalysisReport,
  type AnalysisChapterRelation,
  type StoryAnalysisInput,
} from '../../src/utils/storyAnalysisChecks';

/**
 * Chronology that contradicts itself.
 *
 * A pair holds one live statement, so "A before B" and "B before A" cannot both exist - the table
 * makes a direct contradiction unstorable. What is left is the transitive kind: A before B, B before
 * C, C before A, which no sequence of events satisfies and which nothing else in the app would ever
 * notice.
 *
 * `overlaps` and `simultaneous` are unordered and form no edges: things sharing time contradict
 * nothing, however many of them there are.
 */

const container = (id: string) => ({ id, name: id, index: 1, type: 'event' as const });

const inputWith = (relations: AnalysisChapterRelation[], ids: string[]): StoryAnalysisInput =>
  ({
    storyType: 'linear',
    completenessChecks: false,
    chapters: ids.map(container),
    chapterRelations: relations,
    scenes: [],
    characters: [],
    locations: [],
    items: [],
    itemJourneys: [],
    choices: [],
    choiceCheckGroups: [],
    choiceChecks: [],
    effects: [],
    tags: [],
    tagRelations: [],
    notes: [],
    worldRules: [],
    storySchemaFields: [],
    attributeValues: [],
    characterScenes: [],
    characterRelations: [],
    locationRelations: [],
    noteRelations: [],
    seeAlsoRelations: [],
    stats: [],
    statStrengths: [],
    statRelations: [],
    modes: [],
    plots: [],
    plotScenes: [],
  }) as unknown as StoryAnalysisInput;

const cycleFindings = async (relations: AnalysisChapterRelation[], ids: string[]) =>
  (await buildStoryAnalysisReport(inputWith(relations, ids))).filter(
    (finding) => finding.messageKey === 'analysis_chronology_cycle',
  );

const before = (a: string, b: string) => ({ chapter1Id: a, chapter2Id: b, relationType: 'before' });

describe('contradictory chronology', () => {
  it('says nothing about a chain that goes one way', async () => {
    expect(await cycleFindings([before('a', 'b'), before('b', 'c')], ['a', 'b', 'c'])).toEqual([]);
  });

  it('finds a loop of three', async () => {
    const found = await cycleFindings(
      [before('a', 'b'), before('b', 'c'), before('c', 'a')],
      ['a', 'b', 'c'],
    );

    expect(found).toHaveLength(1);
    expect(found[0]!.messageParams?.names).toContain('a');
  });

  it('finds a loop that sits at the end of a chain', async () => {
    const found = await cycleFindings(
      [before('a', 'b'), before('b', 'c'), before('c', 'd'), before('d', 'b')],
      ['a', 'b', 'c', 'd'],
    );

    expect(found).toHaveLength(1);
    // `a` leads into the loop without being part of it.
    expect(found[0]!.messageParams?.names).not.toContain('a,');
  });

  /** `during` orders too: something inside something else cannot also contain it. */
  it('finds a loop mixing before and during', async () => {
    const found = await cycleFindings(
      [before('a', 'b'), { chapter1Id: 'b', chapter2Id: 'a', relationType: 'during' }],
      ['a', 'b'],
    );

    expect(found).toHaveLength(1);
  });

  /** Two things sharing time contradicts nothing, so these form no edges at all. */
  it.each(['overlaps', 'simultaneous'])('ignores %s entirely', async (relationType) => {
    const found = await cycleFindings(
      [
        { chapter1Id: 'a', chapter2Id: 'b', relationType },
        { chapter1Id: 'b', chapter2Id: 'a', relationType },
      ],
      ['a', 'b'],
    );

    expect(found).toEqual([]);
  });

  it('says nothing when no chronology is stated at all', async () => {
    expect(await cycleFindings([], ['a', 'b'])).toEqual([]);
  });

  /**
   * A long chain must not take the analysis screen down with it. The search is iterative for this
   * reason - recursion is the obvious shape and would blow the stack on the one screen whose job is
   * to report problems calmly.
   */
  it('survives a chain thousands of containers long', async () => {
    const ids = Array.from({ length: 5000 }, (_, index) => `c${index}`);
    const chain = ids.slice(0, -1).map((id, index) => before(id, ids[index + 1]!));

    expect(await cycleFindings(chain, ids)).toEqual([]);
  });

  it('finds a loop closing a very long chain', async () => {
    const ids = Array.from({ length: 3000 }, (_, index) => `c${index}`);
    const chain = ids.slice(0, -1).map((id, index) => before(id, ids[index + 1]!));
    chain.push(before(ids.at(-1)!, ids[0]!));

    expect(await cycleFindings(chain, ids)).toHaveLength(1);
  });
});
