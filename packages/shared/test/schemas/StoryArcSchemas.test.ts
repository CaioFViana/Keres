import { describe, expect, it } from 'vitest';
import { CreateStoryArcDataSchema, StoryArcSchema } from '../../schemas/StoryArcSchemas';

describe('StoryArcSchema', () => {
  it('accepts a default arc', () => {
    expect(
      StoryArcSchema.parse({
        id: 'arc-1',
        storyId: 'story-1',
        title: 'Book I',
        description: null,
        sortOrder: 0,
        color: null,
        icon: null,
        themeOverride: null,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isDeleted: false,
        deletedAt: null,
      }).title,
    ).toBe('Book I');
  });

  it('gives a row written before medium, author and cover their defaults', () => {
    const parsed = StoryArcSchema.parse({
      id: 'arc-1',
      storyId: 'story-1',
      title: 'Book I',
      description: null,
      sortOrder: 0,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    });
    expect(parsed).toMatchObject({
      medium: 'generic',
      vocabulary: null,
      author: null,
      coverGalleryId: null,
    });
  });

  it('accepts every medium and refuses an unknown one', () => {
    for (const medium of ['generic', 'screenplay', 'comic', 'storyboard', 'campaign']) {
      expect(CreateStoryArcDataSchema.parse({ title: 'A', medium }).medium).toBe(medium);
    }
    expect(() => CreateStoryArcDataSchema.parse({ title: 'A', medium: 'podcast' })).toThrow();
  });

  it('rejects a blank title', () => {
    expect(() => CreateStoryArcDataSchema.parse({ title: '  ' })).toThrow();
  });
});
