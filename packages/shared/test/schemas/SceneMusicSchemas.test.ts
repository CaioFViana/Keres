import { describe, expect, it } from 'vitest';
import { rankBetween } from '../../rules/rank';
import {
  CreateSceneMusicDataSchema,
  MAX_SCENE_MUSIC_CUE_LENGTH,
  MAX_SCENE_MUSIC_SECTIONS,
  PartialSceneMusicSchema,
  SceneMusicSchema,
} from '../../schemas/SceneMusicSchemas';

const rank = rankBetween(null, null);
const base = { sceneId: 'scene-1', rank, role: 'score' as const, cue: null, sections: null };

describe('SceneMusic schemas', () => {
  it('links a scene to a song or to a gallery medium, never both and never neither', () => {
    expect(
      CreateSceneMusicDataSchema.safeParse({ ...base, songId: 'song-1', galleryId: null }).success,
    ).toBe(true);
    expect(
      CreateSceneMusicDataSchema.safeParse({ ...base, songId: null, galleryId: 'g-1' }).success,
    ).toBe(true);
    expect(
      CreateSceneMusicDataSchema.safeParse({ ...base, songId: 'song-1', galleryId: 'g-1' }).success,
    ).toBe(false);
    expect(
      CreateSceneMusicDataSchema.safeParse({ ...base, songId: null, galleryId: null }).success,
    ).toBe(false);
  });

  it('defaults the role to score, and the cue and the sections to nothing', () => {
    const parsed = CreateSceneMusicDataSchema.parse({
      sceneId: 'scene-1',
      rank,
      songId: null,
      galleryId: 'g-1',
    });

    expect(parsed).toMatchObject({ role: 'score', cue: null, sections: null });
  });

  it('knows the two roles and no other', () => {
    const link = { ...base, songId: null, galleryId: 'g-1' };

    expect(CreateSceneMusicDataSchema.safeParse({ ...link, role: 'in-world' }).success).toBe(true);
    expect(CreateSceneMusicDataSchema.safeParse({ ...link, role: 'ambient' }).success).toBe(false);
  });

  it('refuses a rank it did not make, a cue too long and sections that are empty or too many', () => {
    const link = { ...base, songId: 'song-1', galleryId: null };

    expect(CreateSceneMusicDataSchema.safeParse({ ...link, rank: 'not a rank!' }).success).toBe(
      false,
    );
    expect(
      CreateSceneMusicDataSchema.safeParse({
        ...link,
        cue: 'x'.repeat(MAX_SCENE_MUSIC_CUE_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(CreateSceneMusicDataSchema.safeParse({ ...link, sections: [''] }).success).toBe(false);
    expect(
      CreateSceneMusicDataSchema.safeParse({
        ...link,
        sections: Array.from({ length: MAX_SCENE_MUSIC_SECTIONS + 1 }, (_, i) => `Verse ${i}`),
      }).success,
    ).toBe(false);
    expect(
      CreateSceneMusicDataSchema.safeParse({ ...link, sections: ['Chorus', 'Verse 2'] }).success,
    ).toBe(true);
  });

  it('lets a stored link keep its note after its target is gone', () => {
    const row = SceneMusicSchema.parse({
      id: 'music-1',
      storyId: 'story-1',
      ...base,
      songId: null,
      galleryId: null,
      cue: 'as she opens the door',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 3,
      isDeleted: false,
      deletedAt: null,
    });

    expect(row.cue).toBe('as she opens the door');
  });

  it('accepts a change of one field at a time', () => {
    // The sync handlers keep only the keys a change names, so the defaults here never reach a row.
    expect(PartialSceneMusicSchema.parse({ role: 'in-world' })).toMatchObject({ role: 'in-world' });
    expect(PartialSceneMusicSchema.parse({ sections: ['Chorus'] })).toMatchObject({
      sections: ['Chorus'],
    });
    expect(PartialSceneMusicSchema.safeParse({ role: 'ambient' }).success).toBe(false);
  });
});
