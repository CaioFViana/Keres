import type { CompileStoryReaderInput, FullStoryExportType } from '@keres/shared';
import { describe, expect, it } from 'vitest';
import { parseManuscriptOptions } from '../../src/services/publicationCompile';
import { withSceneSongs } from '../../src/services/publicationSongs';

const input: CompileStoryReaderInput = {
  storyTitle: 'T',
  storyType: 'linear',
  chapters: [{ id: 'c1', name: 'One', index: 1, type: 'chapter' }],
  scenes: [
    { id: 's1', chapterId: 'c1', name: 'S1', index: 1, body: 'x', isDeleted: false },
    { id: 's2', chapterId: 'c1', name: 'S2', index: 2, body: 'y', isDeleted: false },
  ],
  choices: [],
};

const song = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Song ${id}`,
  lyrics: `[G]words of ${id}`,
  lyricsTranslation: null,
  isDeleted: false,
  ...overrides,
});

const link = (id: string, sceneId: string, overrides: Record<string, unknown> = {}) => ({
  id,
  sceneId,
  rank: id,
  songId: 'a',
  galleryId: null,
  role: 'in-world',
  cue: 'a cue the writer keeps',
  sections: null,
  isDeleted: false,
  ...overrides,
});

const exportOf = (sceneMusic: unknown[], songs: unknown[] = [song('a')]) =>
  ({
    story: { id: 'story-1' },
    songs,
    sceneMusic,
    storyArcs: [],
  }) as unknown as FullStoryExportType;

describe('withSceneSongs', () => {
  it('hands the input back untouched unless the publication prints songs', () => {
    const result = withSceneSongs(input, exportOf([link('m1', 's1')]), { includeSongs: false });

    expect(result).toBe(input);
  });

  it('gives a scene the words of the songs it sings, and the sections it names', () => {
    const result = withSceneSongs(input, exportOf([link('m1', 's1', { sections: ['Chorus'] })]), {
      includeSongs: true,
    });

    expect(result.scenes[0].music).toEqual([
      {
        id: 'm1',
        role: 'in-world',
        title: 'Song a',
        cue: null,
        song: {
          id: 'a',
          title: 'Song a',
          lyrics: '[G]words of a',
          lyricsTranslation: null,
          sections: ['Chorus'],
        },
      },
    ]);
    expect(result.scenes[1].music).toBeUndefined();
  });

  it('never carries the cue the writer keeps about when a piece comes in', () => {
    const result = withSceneSongs(input, exportOf([link('m1', 's1')]), { includeSongs: true });

    expect(JSON.stringify(result)).not.toContain('a cue the writer keeps');
  });

  it('leaves out the score, a Gallery reference, a deleted link and a deleted song', () => {
    const result = withSceneSongs(
      input,
      exportOf(
        [
          link('score', 's1', { role: 'score' }),
          link('reference', 's1', { songId: null, galleryId: 'g-1' }),
          link('gone', 's1', { isDeleted: true }),
          link('dead-song', 's2', { songId: 'b' }),
        ],
        [song('a'), song('b', { isDeleted: true })],
      ),
      { includeSongs: true },
    );

    expect(result).toBe(input);
  });

  it("keeps a scene's songs in the order of their ranks", () => {
    const result = withSceneSongs(
      input,
      exportOf(
        [link('m2', 's1', { rank: 'a1', songId: 'b' }), link('m1', 's1', { rank: 'a0' })],
        [song('a'), song('b')],
      ),
      { includeSongs: true },
    );

    expect(result.scenes[0].music?.map((music) => music.id)).toEqual(['m1', 'm2']);
  });
});

describe("parseManuscriptOptions and the writer's own notes", () => {
  it('turns the music cues and the Fountain notes off whatever is asked', () => {
    const options = parseManuscriptOptions(exportOf([]), {
      format: 'fountain',
      includeMusicCues: true,
      screenplay: { includeMusicNotes: true },
    });

    expect(options.includeMusicCues).toBe(false);
    expect(options.screenplay?.includeMusicNotes).toBe(false);
  });

  it('keeps the songs the publisher asked for', () => {
    const options = parseManuscriptOptions(exportOf([]), {
      format: 'md',
      includeSongs: true,
      songsPlacement: 'after-scene',
      songLanguage: 'both',
    });

    expect(options).toMatchObject({
      includeSongs: true,
      songsPlacement: 'after-scene',
      songLanguage: 'both',
    });
  });
});
