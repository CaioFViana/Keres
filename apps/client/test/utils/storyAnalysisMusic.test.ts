import { checkSceneMusic } from '../../src/utils/storyAnalysis/musicChecks';
import {
  buildStoryAnalysisReport,
  type AnalysisSceneMusic,
  type StoryAnalysisInput,
} from '../../src/utils/storyAnalysisChecks';

const input = (sceneMusic?: AnalysisSceneMusic[]): StoryAnalysisInput => ({
  storyType: 'linear',
  includeCompletenessChecks: false,
  characters: [],
  characterScenes: [],
  characterRelations: [],
  locations: [],
  locationRelations: [],
  scenes: [
    {
      id: 'tavern',
      name: 'The tavern',
      locationId: null,
      isStart: false,
      isFinish: false,
      chapterId: null,
      index: 1,
    },
  ],
  choices: [],
  choiceCheckGroups: [],
  choiceChecks: [],
  effects: [],
  items: [],
  itemJourneys: [],
  tags: [],
  tagRelations: [],
  chapters: [],
  notes: [],
  worldRules: [],
  storySchemaFields: [],
  attributeValues: [],
  ...(sceneMusic ? { sceneMusic } : {}),
});

const music = (id: string, overrides: Partial<AnalysisSceneMusic> = {}): AnalysisSceneMusic => ({
  id,
  sceneId: 'tavern',
  songId: null,
  galleryId: 'g-1',
  targetAlive: true,
  ...overrides,
});

describe('checkSceneMusic', () => {
  it('says nothing for music that points at something that is there, or for no music at all', () => {
    expect(checkSceneMusic(input([music('m1')]))).toEqual([]);
    expect(checkSceneMusic(input([]))).toEqual([]);
    expect(checkSceneMusic(input())).toEqual([]);
  });

  it('warns about music whose target is gone, on the scene it belongs to', () => {
    const [finding] = checkSceneMusic(input([music('m1', { targetAlive: false })]));

    expect(finding).toMatchObject({
      category: 'music',
      severity: 'warning',
      entityType: 'Scene',
      entityId: 'tavern',
      entityName: 'The tavern',
      messageKey: 'analysis_music_target_gone',
    });
  });

  it('calls music with no target at all gone, which is what a cleared target is', () => {
    const [finding] = checkSceneMusic(
      input([music('m1', { galleryId: null, songId: null, targetAlive: false })]),
    );

    expect(finding.messageKey).toBe('analysis_music_target_gone');
  });

  it('refuses music that points at a song and at a medium at once, as an error', () => {
    const [finding] = checkSceneMusic(input([music('m1', { songId: 's-1' })]));

    expect(finding).toMatchObject({ severity: 'error', messageKey: 'analysis_music_two_targets' });
  });

  it('lists each broken link of a scene on its own, under keys that do not collide', () => {
    const findings = checkSceneMusic(
      input([music('m1', { targetAlive: false }), music('m2', { targetAlive: false })]),
    );

    expect(findings).toHaveLength(2);
    expect(new Set(findings.map((finding) => finding.id)).size).toBe(2);
  });

  it('leaves the music of a scene that is not there to that scene', () => {
    expect(checkSceneMusic(input([music('m1', { sceneId: 'gone', targetAlive: false })]))).toEqual(
      [],
    );
  });
});

describe('the music in the analysis', () => {
  it('is reported with the cheap checks, whatever the story is for and whatever the switch says', async () => {
    const findings = await buildStoryAnalysisReport(input([music('m1', { targetAlive: false })]));

    expect(findings.map((finding) => finding.messageKey)).toContain('analysis_music_target_gone');
  });
});
