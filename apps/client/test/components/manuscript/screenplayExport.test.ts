import { defaultExportSettings } from '../../../src/components/features/manuscript/export/manuscriptExportSettings';
import {
  screenplayInputOf,
  screenplayOptionsOf,
} from '../../../src/components/features/manuscript/export/screenplayExport';

const chapter = {
  id: 'ch-1',
  name: 'One',
  index: 1,
  type: 'chapter',
  arcId: null,
} as never;

const scene = (id: string) =>
  ({
    id,
    chapterId: 'ch-1',
    locationId: null,
    name: id,
    index: 1,
    body: 'Action.',
    isDeleted: false,
    summary: null,
  }) as never;

const build = (music?: Map<string, { id: string; role: 'score'; title: string; cue: null }[]>) =>
  screenplayInputOf({
    title: 'Script',
    chapters: [chapter],
    scenes: [scene('s1'), scene('s2')],
    locations: [],
    arcs: [],
    music,
  });

describe('screenplayInputOf', () => {
  it('carries the music of the scenes that have some, and nothing for the rest', () => {
    const music = new Map([
      ['s1', [{ id: 'm1', role: 'score' as const, title: 'Theme', cue: null }]],
    ]);

    const input = build(music);

    expect(input.scenes[0]).toMatchObject({ id: 's1', music: [{ id: 'm1', title: 'Theme' }] });
    expect('music' in input.scenes[1]).toBe(false);
  });

  it('carries no music when none is given', () => {
    expect(build().scenes.some((item) => 'music' in item)).toBe(false);
  });
});

describe('screenplayOptionsOf', () => {
  it('writes the music as notes only when the export asks for it', () => {
    const settings = { ...defaultExportSettings('Ana'), format: 'fountain' as const };

    expect(screenplayOptionsOf(settings, 'en').screenplay?.includeMusicNotes).toBe(false);
    expect(
      screenplayOptionsOf({ ...settings, includeMusicCues: true }, 'en').screenplay
        ?.includeMusicNotes,
    ).toBe(true);
  });

  it('says what a note starts with in the language of the person', () => {
    const settings = { ...defaultExportSettings('Ana'), format: 'fountain' as const };

    expect(screenplayOptionsOf(settings, 'pt', 'Música').labels?.musicLabel).toBe('Música');
    expect(screenplayOptionsOf(settings, 'en').labels).toBeUndefined();
  });
});
