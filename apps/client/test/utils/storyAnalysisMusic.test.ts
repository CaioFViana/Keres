import {
  checkSceneMusic,
  checkSongs,
  checkUnusedSongs,
} from '../../src/utils/storyAnalysis/musicChecks';
import {
  buildStoryAnalysisReport,
  type AnalysisSceneMusic,
  type AnalysisSong,
  type StoryAnalysisInput,
} from '../../src/utils/storyAnalysisChecks';

const input = (sceneMusic?: AnalysisSceneMusic[], songs?: AnalysisSong[]): StoryAnalysisInput => ({
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
  ...(songs ? { songs } : {}),
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

const song = (overrides: Partial<AnalysisSong> = {}): AnalysisSong => ({
  id: 's-1',
  title: 'The Lantern Song',
  sectionLabels: ['Verse 1', 'Chorus'],
  translationLabels: null,
  ...overrides,
});

const sings = (sections: string[] | null, id = 'm1') =>
  music(id, { galleryId: null, songId: 's-1', sections });

describe('the sections a scene names of a song', () => {
  it('says nothing while every section named is still in the song', () => {
    expect(checkSceneMusic(input([sings(['Chorus'])], [song()]))).toEqual([]);
    expect(checkSceneMusic(input([sings(null)], [song()]))).toEqual([]);
  });

  it('lists the sections that are gone when others remain, and what is printed instead', () => {
    const [finding] = checkSceneMusic(input([sings(['Chorus', 'Bridge', 'Outro'])], [song()]));

    expect(finding).toMatchObject({
      severity: 'warning',
      entityType: 'Scene',
      entityId: 'tavern',
      messageKey: 'analysis_music_sections_gone',
      messageParams: { song: 'The Lantern Song', sections: 'Bridge, Outro' },
    });
  });

  it('says the whole song is printed when every section named is gone', () => {
    const [finding] = checkSceneMusic(input([sings(['Bridge'])], [song()]));

    expect(finding).toMatchObject({
      messageKey: 'analysis_music_sections_all_gone',
      messageParams: { song: 'The Lantern Song' },
    });
  });

  it('does not hold a song whose words were not read to labels it never had to give', () => {
    expect(checkSceneMusic(input([sings(['Bridge'])], [song({ sectionLabels: null })]))).toEqual(
      [],
    );
  });

  it('leaves a link whose song is gone to the finding about its target', () => {
    const findings = checkSceneMusic(
      input(
        [sings(['Chorus'])].map((m) => ({ ...m, targetAlive: false })),
        [],
      ),
    );

    expect(findings.map((f) => f.messageKey)).toEqual(['analysis_music_target_gone']);
  });
});

describe('checkSongs', () => {
  it('warns when a label is written twice and a scene names it', () => {
    const [finding] = checkSongs(
      input([sings(['Verse'])], [song({ sectionLabels: ['Verse', 'Chorus', 'Verse'] })]),
    );

    expect(finding).toMatchObject({
      entityType: 'Song',
      entityId: 's-1',
      entityName: 'The Lantern Song',
      messageKey: 'analysis_song_duplicate_sections',
      messageParams: { sections: 'Verse' },
    });
  });

  it('lets a repeated label be, as long as no scene names it', () => {
    expect(
      checkSongs(
        input([sings(['Chorus'])], [song({ sectionLabels: ['Verse', 'Chorus', 'Verse'] })]),
      ),
    ).toEqual([]);
  });

  it('warns about the parts the translation and the words do not share, from either side', () => {
    const [finding] = checkSongs(input([], [song({ translationLabels: ['Verse 1', 'Refrão'] })]));

    expect(finding).toMatchObject({
      entityType: 'Song',
      messageKey: 'analysis_song_translation_mismatch',
      messageParams: { sections: 'Chorus, Refrão' },
    });
  });

  it('says nothing of a translation that matches, or of a song with none', () => {
    expect(checkSongs(input([], [song({ translationLabels: ['Chorus', 'Verse 1'] })]))).toEqual([]);
    expect(checkSongs(input([], [song()]))).toEqual([]);
  });
});

describe('checkUnusedSongs', () => {
  it('names the songs that no scene sings', () => {
    const findings = checkUnusedSongs(
      input([sings(null)], [song(), song({ id: 's-2', title: 'Unsung' })]),
    );

    expect(findings.map((f) => [f.entityId, f.messageKey])).toEqual([
      ['s-2', 'analysis_song_unused'],
    ]);
  });

  it('only appears with the completeness switch on', async () => {
    const withSong = input([], [song()]);

    expect(
      (await buildStoryAnalysisReport({ ...withSong, includeCompletenessChecks: false })).map(
        (f) => f.messageKey,
      ),
    ).toEqual([]);
    expect(
      (await buildStoryAnalysisReport({ ...withSong, includeCompletenessChecks: true })).map(
        (f) => f.messageKey,
      ),
    ).toEqual(['analysis_song_unused']);
  });
});
