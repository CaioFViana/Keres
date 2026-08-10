import { buildStoryAnalysisReport, type StoryAnalysisInput } from '../../src/utils/storyAnalysisChecks';

const baseInput = (): StoryAnalysisInput => ({
  storyType: 'branching',
  characters: [{ id: 'character', name: 'Character' }],
  characterScenes: [], characterRelations: [],
  locations: [{ id: 'location', name: 'Location' }], locationRelations: [],
  scenes: [{ id: 'start', name: 'Start', locationId: 'location', isStart: true, isFinish: false }],
  choices: [],
  items: [{ id: 'item', name: 'Item' }], itemJourneys: [],
  tags: [{ id: 'tag', name: 'Tag' }], tagRelations: [],
  chapters: [], notes: [], worldRules: [], storySchemaFields: [], attributeValues: [],
});

describe('buildStoryAnalysisReport', () => {
  it('finds unused entities and isolated scenes in a branching story', () => {
    const input = baseInput();
    input.scenes.push({ id: 'isolated', name: 'Isolated', locationId: 'location', isStart: false, isFinish: false });

    const keys = buildStoryAnalysisReport(input).map(finding => finding.messageKey);

    expect(keys).toEqual(expect.arrayContaining([
      'analysis_character_no_scenes',
      'analysis_character_no_relationships',
      'analysis_location_no_connections',
      'analysis_item_unused',
      'analysis_tag_unused',
      'analysis_scene_isolated',
    ]));
  });

  it('reports the single actionable error when a non-empty branching story has no start', () => {
    const input = baseInput();
    input.scenes[0].isStart = false;

    const findings = buildStoryAnalysisReport(input);

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'scenes:no_start_scene', messageKey: 'analysis_no_start_scene', severity: 'error' }),
    ]));
    expect(findings.some(finding => ['analysis_scene_unreachable', 'analysis_scene_isolated'].includes(finding.messageKey))).toBe(false);
  });
});
