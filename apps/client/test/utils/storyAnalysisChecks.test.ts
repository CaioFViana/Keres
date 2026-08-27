import {
  buildStoryAnalysisReport,
  COMPLETENESS_FINDING_KEYS,
  type StoryAnalysisInput,
} from '../../src/utils/storyAnalysisChecks';

const baseInput = (): StoryAnalysisInput => ({
  storyType: 'branching',
  // The existing cases are all about integrity, which does not depend on the switch. The switch has
  // its own describe block at the end of this file.
  includeCompletenessChecks: false,
  characters: [{ id: 'character', name: 'Character' }],
  characterScenes: [],
  characterRelations: [],
  locations: [{ id: 'location', name: 'Location' }],
  locationRelations: [],
  scenes: [
    {
      id: 'start',
      name: 'Start',
      locationId: 'location',
      isStart: true,
      isFinish: false,
      chapterId: 'chapter',
      index: 1,
    },
  ],
  choices: [],
  choiceCheckGroups: [],
  choiceChecks: [],
  effects: [],
  items: [{ id: 'item', name: 'Item' }],
  itemJourneys: [],
  tags: [{ id: 'tag', name: 'Tag' }],
  tagRelations: [],
  chapters: [],
  notes: [],
  worldRules: [],
  storySchemaFields: [],
  attributeValues: [],
});

describe('duplicate relations', () => {
  const twoCharacters = () => {
    const input = baseInput();
    input.characters.push({ id: 'other', name: 'Other' });
    input.characterScenes.push({ characterId: 'character' }, { characterId: 'other' });
    return input;
  };

  /**
   * The analysis reported a clean bill of health on the bundled examples while they carried the same
   * pair of characters related twice - there simply was no check for it.
   */
  it('reports the same pair of characters related twice, whichever way round', async () => {
    const input = twoCharacters();
    input.characterRelations.push(
      { character1Id: 'character', character2Id: 'other' },
      { character1Id: 'other', character2Id: 'character' },
    );

    const findings = await buildStoryAnalysisReport(input);
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageKey: 'analysis_duplicate_character_relation',
          severity: 'error',
          entityId: 'other',
          messageParams: { otherName: 'Character' },
        }),
      ]),
    );
  });

  it('says nothing about a single relation per pair', async () => {
    const input = twoCharacters();
    input.characterRelations.push({ character1Id: 'character', character2Id: 'other' });

    expect(await buildStoryAnalysisReport(input)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ messageKey: 'analysis_duplicate_character_relation' }),
      ]),
    );
  });

  /** Two places can be both "contains" and "connected_to"; they cannot contain each other twice. */
  it('reports duplicate location connections only within the same type', async () => {
    const input = baseInput();
    input.locations.push({ id: 'other-location', name: 'Other Location' });
    input.locationRelations.push(
      { locationAId: 'location', locationBId: 'other-location', relationType: 'contains' },
      { locationAId: 'location', locationBId: 'other-location', relationType: 'connected_to' },
    );
    expect(await buildStoryAnalysisReport(input)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ messageKey: 'analysis_duplicate_location_relation' }),
      ]),
    );

    input.locationRelations.push({
      locationAId: 'other-location',
      locationBId: 'location',
      relationType: 'contains',
    });
    expect(await buildStoryAnalysisReport(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageKey: 'analysis_duplicate_location_relation',
          severity: 'error',
        }),
      ]),
    );
  });
});

describe('buildStoryAnalysisReport', () => {
  it('warns when an entity attribute points to a deleted target', async () => {
    const input = baseInput();
    input.storySchemaFields.push({
      id: 'mentor',
      entityType: 'Character',
      name: 'Mentor',
      type: 'entity',
      targetEntityType: 'Character',
      isRequired: false,
    });
    input.attributeValues.push({ fieldId: 'mentor', entityId: 'character', value: 'deleted' });

    expect(await buildStoryAnalysisReport(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageKey: 'analysis_attribute_entity_missing',
          entityId: 'character',
        }),
      ]),
    );
  });

  it('finds unused entities and isolated scenes in a branching story', async () => {
    // Unused entities are completeness findings, so this case asks for them explicitly.
    const input = { ...baseInput(), includeCompletenessChecks: true };
    input.scenes.push({
      id: 'isolated',
      name: 'Isolated',
      locationId: 'location',
      isStart: false,
      isFinish: false,
      chapterId: 'chapter',
      index: 1,
    });

    const keys = (await buildStoryAnalysisReport(input)).map((finding) => finding.messageKey);

    expect(keys).toEqual(
      expect.arrayContaining([
        'analysis_character_no_scenes',
        'analysis_character_no_relationships',
        'analysis_location_no_connections',
        'analysis_item_unused',
        'analysis_tag_unused',
        'analysis_scene_isolated',
      ]),
    );
  });

  it('reports the single actionable error when a non-empty branching story has no start', async () => {
    const input = baseInput();
    input.scenes[0].isStart = false;

    const findings = await buildStoryAnalysisReport(input);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'scenes:no_start_scene',
          messageKey: 'analysis_no_start_scene',
          severity: 'error',
        }),
      ]),
    );
    expect(
      findings.some((finding) =>
        ['analysis_scene_unreachable', 'analysis_scene_isolated'].includes(finding.messageKey),
      ),
    ).toBe(false);
  });

  describe('choice checks', () => {
    it('flags a choice whose inventory check requires an item that is never granted anywhere', async () => {
      const input = baseInput();
      input.scenes.push({
        id: 'end',
        name: 'End',
        locationId: 'location',
        isStart: false,
        isFinish: false,
        chapterId: 'chapter',
        index: 1,
      });
      input.choices.push({ id: 'choice1', sceneId: 'start', nextSceneId: 'end', text: 'go' });
      input.choiceCheckGroups.push({ id: 'g1', choiceId: 'choice1', combinator: 'AND' });
      input.choiceChecks.push({
        id: 'c1',
        groupId: 'g1',
        mode: 'enable',
        type: 'inventory',
        sceneId: null,
        minVisits: null,
        itemId: 'item',
        itemPresence: 'has',
        triggerName: null,
        triggerState: null,
      });

      const keys = (await buildStoryAnalysisReport(input)).map((f) => f.messageKey);

      expect(keys).toContain('analysis_choice_never_satisfiable');
    });

    it('flags a scene-count check requiring more than one visit when there is no cycle to revisit it', async () => {
      const input = baseInput();
      input.scenes.push(
        {
          id: 'target',
          name: 'Target',
          locationId: 'location',
          isStart: false,
          isFinish: false,
          chapterId: 'chapter',
          index: 1,
        },
        {
          id: 'end',
          name: 'End',
          locationId: 'location',
          isStart: false,
          isFinish: false,
          chapterId: 'chapter',
          index: 1,
        },
      );
      input.choices.push(
        { id: 'toTarget', sceneId: 'start', nextSceneId: 'target', text: 'go' },
        { id: 'toEnd', sceneId: 'target', nextSceneId: 'end', text: 'proceed' },
      );
      input.choiceCheckGroups.push({ id: 'g1', choiceId: 'toEnd', combinator: 'AND' });
      input.choiceChecks.push({
        id: 'c1',
        groupId: 'g1',
        mode: 'enable',
        type: 'sceneCount',
        sceneId: 'target',
        minVisits: 2,
        itemId: null,
        itemPresence: null,
        triggerName: null,
        triggerState: null,
      });

      const keys = (await buildStoryAnalysisReport(input)).map((f) => f.messageKey);

      expect(keys).toContain('analysis_choice_never_satisfiable');
    });

    it('does not flag a scene-count check requiring more than one visit when the scene is revisitable via a cycle', async () => {
      const input = baseInput();
      input.scenes.push(
        {
          id: 'target',
          name: 'Target',
          locationId: 'location',
          isStart: false,
          isFinish: false,
          chapterId: 'chapter',
          index: 1,
        },
        {
          id: 'end',
          name: 'End',
          locationId: 'location',
          isStart: false,
          isFinish: false,
          chapterId: 'chapter',
          index: 1,
        },
      );
      input.choices.push(
        { id: 'toTarget', sceneId: 'start', nextSceneId: 'target', text: 'go' },
        { id: 'loopBack', sceneId: 'target', nextSceneId: 'start', text: 'go back' },
        { id: 'toEnd', sceneId: 'target', nextSceneId: 'end', text: 'proceed' },
      );
      input.choiceCheckGroups.push({ id: 'g1', choiceId: 'toEnd', combinator: 'AND' });
      input.choiceChecks.push({
        id: 'c1',
        groupId: 'g1',
        mode: 'enable',
        type: 'sceneCount',
        sceneId: 'target',
        minVisits: 2,
        itemId: null,
        itemPresence: null,
        triggerName: null,
        triggerState: null,
      });

      const keys = (await buildStoryAnalysisReport(input)).map((f) => f.messageKey);

      expect(keys).not.toContain('analysis_choice_never_satisfiable');
    });

    it('is satisfiable when an OR group has at least one check that can pass', async () => {
      const input = baseInput();
      input.scenes.push({
        id: 'end',
        name: 'End',
        locationId: 'location',
        isStart: false,
        isFinish: false,
        chapterId: 'chapter',
        index: 1,
      });
      input.choices.push({ id: 'choice1', sceneId: 'start', nextSceneId: 'end', text: 'go' });
      input.choiceCheckGroups.push({ id: 'g1', choiceId: 'choice1', combinator: 'OR' });
      input.choiceChecks.push(
        {
          id: 'c1',
          groupId: 'g1',
          mode: 'enable',
          type: 'inventory',
          sceneId: null,
          minVisits: null,
          itemId: 'item',
          itemPresence: 'has',
          triggerName: null,
          triggerState: null,
        },
        {
          id: 'c2',
          groupId: 'g1',
          mode: 'enable',
          type: 'trigger',
          sceneId: null,
          minVisits: null,
          itemId: null,
          itemPresence: null,
          triggerName: 'flag',
          triggerState: 'unset',
        },
      );

      const keys = (await buildStoryAnalysisReport(input)).map((f) => f.messageKey);

      expect(keys).not.toContain('analysis_choice_never_satisfiable');
    });

    it('cascades to scene reachability: a scene only reachable via a never-satisfiable choice is reported unreachable', async () => {
      const input = baseInput();
      input.scenes.push({
        id: 'onlyVia',
        name: 'Only Via',
        locationId: 'location',
        isStart: false,
        isFinish: false,
        chapterId: 'chapter',
        index: 1,
      });
      input.choices.push({ id: 'choice1', sceneId: 'start', nextSceneId: 'onlyVia', text: 'go' });
      input.choiceCheckGroups.push({ id: 'g1', choiceId: 'choice1', combinator: 'AND' });
      input.choiceChecks.push({
        id: 'c1',
        groupId: 'g1',
        mode: 'enable',
        type: 'inventory',
        sceneId: null,
        minVisits: null,
        itemId: 'item',
        itemPresence: 'has',
        triggerName: null,
        triggerState: null,
      });

      const findings = await buildStoryAnalysisReport(input);
      const keys = findings.map((f) => f.messageKey);

      expect(keys).toContain('analysis_choice_never_satisfiable');
      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entityId: 'onlyVia',
            messageKey: 'analysis_scene_unreachable',
          }),
        ]),
      );
    });

    it('cascades through two levels: a choice gated on a scene that is itself only reachable via a never-satisfiable choice', async () => {
      const input = baseInput();
      input.scenes.push(
        {
          id: 'sceneX',
          name: 'Scene X',
          locationId: 'location',
          isStart: false,
          isFinish: false,
          chapterId: 'chapter',
          index: 1,
        },
        {
          id: 'sceneY',
          name: 'Scene Y',
          locationId: 'location',
          isStart: false,
          isFinish: false,
          chapterId: 'chapter',
          index: 1,
        },
      );
      // Branch 1: start -> sceneX, gated on an item that is never granted anywhere - sceneX can
      // never actually be reached, even though it's structurally connected to the graph.
      input.choices.push({
        id: 'toSceneX',
        sceneId: 'start',
        nextSceneId: 'sceneX',
        text: 'go to X',
      });
      input.choiceCheckGroups.push({ id: 'gX', choiceId: 'toSceneX', combinator: 'AND' });
      input.choiceChecks.push({
        id: 'cX',
        groupId: 'gX',
        mode: 'enable',
        type: 'inventory',
        sceneId: null,
        minVisits: null,
        itemId: 'item',
        itemPresence: 'has',
        triggerName: null,
        triggerState: null,
      });
      // Branch 2: start -> sceneY, gated on "sceneX visited at least once" - only satisfiable if
      // sceneX is actually reachable, which it isn't once the first check is accounted for.
      input.choices.push({
        id: 'toSceneY',
        sceneId: 'start',
        nextSceneId: 'sceneY',
        text: 'go to Y',
      });
      input.choiceCheckGroups.push({ id: 'gY', choiceId: 'toSceneY', combinator: 'AND' });
      input.choiceChecks.push({
        id: 'cY',
        groupId: 'gY',
        mode: 'enable',
        type: 'sceneCount',
        sceneId: 'sceneX',
        minVisits: 1,
        itemId: null,
        itemPresence: null,
        triggerName: null,
        triggerState: null,
      });

      const findings = await buildStoryAnalysisReport(input);
      const neverSatisfiableChoiceIds = findings
        .filter((f) => f.messageKey === 'analysis_choice_never_satisfiable')
        .map((f) => f.entityId);

      expect(neverSatisfiableChoiceIds).toEqual(expect.arrayContaining(['toSceneX', 'toSceneY']));
      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ entityId: 'sceneX', messageKey: 'analysis_scene_unreachable' }),
          expect.objectContaining({ entityId: 'sceneY', messageKey: 'analysis_scene_unreachable' }),
        ]),
      );
    });
  });
});

/**
 * Numbering outside 1..N is not fussiness: the API refuses a reorder whose indices do not form a
 * contiguous 1..N, so the check is the warning before the synchronization conflict.
 */
describe('narrative index checks', () => {
  const linearInput = (): StoryAnalysisInput => {
    const input = baseInput();
    input.storyType = 'linear';
    input.chapters = [{ id: 'chapter', name: 'Capítulo', index: 1 }];
    input.scenes = [];
    return input;
  };
  const scene = (id: string, index: number) => ({
    id,
    name: id,
    locationId: 'location',
    isStart: false,
    isFinish: false,
    chapterId: 'chapter',
    index,
  });

  it('says nothing about numbering when chapters and scenes are 1..N', async () => {
    const input = linearInput();
    input.scenes.push(scene('a', 1), scene('b', 2));

    const findings = await buildStoryAnalysisReport(input);

    expect(findings.filter((finding) => finding.messageKey.includes('_index_'))).toEqual([]);
  });

  it('flags a gap in the scene numbering of a chapter', async () => {
    const input = linearInput();
    input.scenes.push(scene('a', 1), scene('b', 3));

    expect(await buildStoryAnalysisReport(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageKey: 'analysis_scene_index_gap',
          messageParams: { chapterName: 'Capítulo' },
        }),
      ]),
    );
  });

  it('flags two scenes fighting over the same number', async () => {
    const input = linearInput();
    input.scenes.push(scene('a', 1), scene('b', 1));

    expect(await buildStoryAnalysisReport(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ messageKey: 'analysis_scene_index_duplicate' }),
      ]),
    );
  });

  it('flags scenes still numbered from zero', async () => {
    const input = linearInput();
    input.scenes.push(scene('a', 0), scene('b', 1));

    expect(await buildStoryAnalysisReport(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ messageKey: 'analysis_scene_index_start' }),
      ]),
    );
  });

  it('flags chapter numbering that does not start at 1', async () => {
    const input = linearInput();
    input.chapters = [
      { id: 'chapter', name: 'Capítulo', index: 2 },
      { id: 'other', name: 'Outro', index: 3 },
    ];

    expect(await buildStoryAnalysisReport(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ messageKey: 'analysis_chapter_index_start' }),
      ]),
    );
  });

  it('stays out of branching stories, where the index is not the reading order', async () => {
    const input = linearInput();
    input.storyType = 'branching';
    input.scenes.push(scene('a', 1), scene('b', 3));

    expect(await buildStoryAnalysisReport(input)).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ messageKey: 'analysis_scene_index_gap' }),
      ]),
    );
  });
});

/**
 * The line between integrity and opinion.
 *
 * The switch exists because a location in no scene is a defect in a novel's outline and a perfectly
 * ordinary place in a world bible - Keres cannot know which, so it does not guess by default. What
 * it must never stop reporting is a reference pointing at something that does not exist.
 */
describe('completeness checks', () => {
  /** A story where every completeness check has something to complain about, and nothing is broken. */
  const tidyButUnreferenced = (): StoryAnalysisInput => ({
    ...baseInput(),
    storyType: 'linear',
    chapters: [{ id: 'chapter', name: 'Chapter', index: 1 }],
    // The scene's own location is referenced by definition; the unused one is this second entry.
    locations: [
      { id: 'location', name: 'Location' },
      { id: 'unvisited', name: 'Unvisited' },
    ],
  });

  /** Which *kinds* of finding appear, not how many - two locations both lack connections. */
  const keysOf = (findings: { messageKey: string }[]) =>
    [...new Set(findings.map((f) => f.messageKey))].sort();

  it('reports nothing about unreferenced elements when the switch is off', async () => {
    const findings = await buildStoryAnalysisReport({
      ...tidyButUnreferenced(),
      includeCompletenessChecks: false,
    });

    expect(findings).toEqual([]);
  });

  it('reports every unreferenced element when the switch is on', async () => {
    const findings = await buildStoryAnalysisReport({
      ...tidyButUnreferenced(),
      includeCompletenessChecks: true,
    });

    expect(keysOf(findings)).toEqual(
      [
        'analysis_character_no_relationships',
        'analysis_character_no_scenes',
        'analysis_item_unused',
        'analysis_location_no_connections',
        'analysis_location_unused',
        'analysis_tag_unused',
      ].sort(),
    );
  });

  it('keeps reporting a broken reference with the switch off', async () => {
    const findings = await buildStoryAnalysisReport({
      ...tidyButUnreferenced(),
      storyType: 'branching',
      choices: [{ id: 'choice', text: 'Go', sceneId: 'start', nextSceneId: 'missing' }],
    });

    expect(keysOf(findings)).toContain('analysis_choice_dangling_next_scene');
  });

  it('keeps holding the writer to a field they marked required', async () => {
    const findings = await buildStoryAnalysisReport({
      ...tidyButUnreferenced(),
      storySchemaFields: [
        {
          id: 'field',
          entityType: 'Character',
          name: 'Age',
          type: 'text',
          targetEntityType: null,
          isRequired: true,
        },
      ],
    });

    expect(keysOf(findings)).toContain('analysis_attribute_required_missing');
  });

  it('never emits a completeness key that is missing from COMPLETENESS_FINDING_KEYS', async () => {
    const withSwitch = await buildStoryAnalysisReport({
      ...tidyButUnreferenced(),
      includeCompletenessChecks: true,
    });
    const withoutSwitch = await buildStoryAnalysisReport({
      ...tidyButUnreferenced(),
      includeCompletenessChecks: false,
    });

    const gatedKeys = withSwitch
      .map((finding) => finding.messageKey)
      .filter((key) => !withoutSwitch.some((finding) => finding.messageKey === key));

    // A new check that only appears with the switch on has to be classified, or this fails naming it.
    expect([...new Set(gatedKeys)].sort()).toEqual([...COMPLETENESS_FINDING_KEYS].sort());
  });
});

/**
 * Anchors that run backwards.
 *
 * This replaced a cycle check, and the difference is worth stating: interval relations could
 * contradict each other in a loop, so the old check searched for one. A stretch is two points on a
 * single axis - the only way it can be wrong is by ending before it starts, which happens when the
 * writer picks the two scenes the wrong way round and which nothing else in the app would notice.
 */
describe('anchors that run backwards', () => {
  const anchoredInput = (
    anchors: NonNullable<StoryAnalysisInput['chapterAnchors']>,
  ): StoryAnalysisInput => ({
    ...baseInput(),
    chapters: [
      { id: 'one', name: 'Chapter One', index: 1 },
      { id: 'two', name: 'Chapter Two', index: 2 },
      { id: 'event', name: 'The War', index: 1 },
    ],
    scenes: [
      {
        id: 'a',
        name: 'A',
        locationId: 'location',
        isStart: true,
        isFinish: false,
        chapterId: 'one',
        index: 1,
      },
      {
        id: 'b',
        name: 'B',
        locationId: 'location',
        isStart: false,
        isFinish: true,
        chapterId: 'one',
        index: 2,
      },
      {
        id: 'c',
        name: 'C',
        locationId: 'location',
        isStart: false,
        isFinish: true,
        chapterId: 'two',
        index: 1,
      },
    ],
    chapterAnchors: anchors,
  });

  const anchor = (overrides = {}) => ({
    chapterId: 'event',
    order: 1,
    startSceneId: 'a',
    startPosition: 'start',
    endSceneId: 'c',
    endPosition: 'end',
    ...overrides,
  });

  const keys = async (input: StoryAnalysisInput) =>
    (await buildStoryAnalysisReport(input)).map((finding) => finding.messageKey);

  it('says nothing about a stretch that runs forwards', async () => {
    expect(await keys(anchoredInput([anchor()]))).not.toContain('analysis_anchor_backwards');
  });

  it('reports a stretch whose scenes are in the wrong order', async () => {
    const found = await keys(anchoredInput([anchor({ startSceneId: 'c', endSceneId: 'a' })]));

    expect(found).toContain('analysis_anchor_backwards');
  });

  it('compares by container first, so a later chapter loses to an earlier one', async () => {
    // Scene 'c' is scene 1 of chapter two; 'b' is scene 2 of chapter one. Read by scene number
    // alone this looks forwards, and it is not.
    const found = await keys(anchoredInput([anchor({ startSceneId: 'c', endSceneId: 'b' })]));

    expect(found).toContain('analysis_anchor_backwards');
  });

  it('separates two points inside the same scene by where in it they fall', async () => {
    const backwards = await keys(
      anchoredInput([
        anchor({ startSceneId: 'b', startPosition: 'end', endSceneId: 'b', endPosition: 'start' }),
      ]),
    );
    const forwards = await keys(
      anchoredInput([
        anchor({ startSceneId: 'b', startPosition: 'start', endSceneId: 'b', endPosition: 'end' }),
      ]),
    );

    expect(backwards).toContain('analysis_anchor_backwards');
    expect(forwards).not.toContain('analysis_anchor_backwards');
  });

  it('stays quiet about a scene it was not given, which is not its business to report', async () => {
    const found = await keys(anchoredInput([anchor({ startSceneId: 'missing' })]));

    expect(found).not.toContain('analysis_anchor_backwards');
  });

  it('stays quiet when no anchors were passed at all', async () => {
    const found = await keys({ ...baseInput(), chapterAnchors: undefined });

    expect(found).not.toContain('analysis_anchor_backwards');
  });

  it('stays quiet about an open stretch, which has no end to run backwards of', async () => {
    const found = await keys(
      anchoredInput([anchor({ endSceneId: null, endPosition: null })]),
    );

    expect(found).not.toContain('analysis_anchor_backwards');
  });
});
