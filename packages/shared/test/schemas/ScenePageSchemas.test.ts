import { describe, expect, it } from 'vitest';
import { rankBetween } from '../../rules/rank';
import {
  CreateScenePageDataSchema,
  MAX_SCENE_PAGE_TEXT_LENGTH,
  PartialScenePageSchema,
  ScenePageSchema,
} from '../../schemas/ScenePageSchemas';

const rank = rankBetween(null, null);
const base = { sceneId: 'scene-1', rank, fit: 'contain' as const, text: null };

describe('ScenePage schemas', () => {
  it('makes a page from a sketch or from a gallery medium, never both and never neither', () => {
    expect(
      CreateScenePageDataSchema.safeParse({ ...base, sketchId: 'sk-1', galleryId: null }).success,
    ).toBe(true);
    expect(
      CreateScenePageDataSchema.safeParse({ ...base, sketchId: null, galleryId: 'g-1' }).success,
    ).toBe(true);
    expect(
      CreateScenePageDataSchema.safeParse({ ...base, sketchId: 'sk-1', galleryId: 'g-1' }).success,
    ).toBe(false);
    expect(
      CreateScenePageDataSchema.safeParse({ ...base, sketchId: null, galleryId: null }).success,
    ).toBe(false);
  });

  it('defaults the fit to contain and the text to nothing', () => {
    const parsed = CreateScenePageDataSchema.parse({
      sceneId: 'scene-1',
      rank,
      sketchId: 'sk-1',
      galleryId: null,
    });

    expect(parsed).toMatchObject({ fit: 'contain', text: null });
  });

  it('refuses a rank it did not make, an unknown fit and a page of text too long', () => {
    const page = { ...base, sketchId: 'sk-1', galleryId: null };

    expect(CreateScenePageDataSchema.safeParse({ ...page, rank: 'not a rank!' }).success).toBe(
      false,
    );
    expect(CreateScenePageDataSchema.safeParse({ ...page, fit: 'stretch' }).success).toBe(false);
    expect(
      CreateScenePageDataSchema.safeParse({
        ...page,
        text: 'x'.repeat(MAX_SCENE_PAGE_TEXT_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('lets a stored page keep its text after its image is gone', () => {
    const row = ScenePageSchema.parse({
      id: 'page-1',
      storyId: 'story-1',
      ...base,
      sketchId: null,
      galleryId: null,
      text: 'Panel 1: she waits.',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 3,
      isDeleted: false,
      deletedAt: null,
    });

    expect(row.text).toBe('Panel 1: she waits.');
  });

  it('accepts a change of one field at a time', () => {
    // The sync handlers keep only the keys a change names, so the defaults here never reach a row.
    expect(PartialScenePageSchema.parse({ fit: 'cover' })).toMatchObject({ fit: 'cover' });
    expect(PartialScenePageSchema.parse({ text: 'New.' })).toMatchObject({ text: 'New.' });
    expect(PartialScenePageSchema.safeParse({ fit: 'stretch' }).success).toBe(false);
  });
});
