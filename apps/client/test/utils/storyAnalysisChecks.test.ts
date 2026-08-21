import {
  buildStoryAnalysisReport,
  type StoryAnalysisInput,
} from '../../src/utils/storyAnalysisChecks';

const baseInput = (): StoryAnalysisInput => ({
  storyType: 'branching',
  characters: [{ id: 'character', name: 'Character' }],
  characterScenes: [],
  characterRelations: [],
  locations: [{ id: 'location', name: 'Location' }],
  locationRelations: [],
  scenes: [{ id: 'start', name: 'Start', locationId: 'location', isStart: true, isFinish: false }],
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
    const input = baseInput();
    input.scenes.push({
      id: 'isolated',
      name: 'Isolated',
      locationId: 'location',
      isStart: false,
      isFinish: false,
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
        { id: 'target', name: 'Target', locationId: 'location', isStart: false, isFinish: false },
        { id: 'end', name: 'End', locationId: 'location', isStart: false, isFinish: false },
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
        { id: 'target', name: 'Target', locationId: 'location', isStart: false, isFinish: false },
        { id: 'end', name: 'End', locationId: 'location', isStart: false, isFinish: false },
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
        { id: 'sceneX', name: 'Scene X', locationId: 'location', isStart: false, isFinish: false },
        { id: 'sceneY', name: 'Scene Y', locationId: 'location', isStart: false, isFinish: false },
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
      const keys = findings.map((f) => f.messageKey);
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
