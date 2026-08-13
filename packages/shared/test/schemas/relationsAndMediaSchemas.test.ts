import { describe, expect, it } from 'vitest';
import {
  CreateCharacterRelationDataSchema,
  CreateEffectDataSchema,
  CreateGalleryDataSchema,
  CreateLocationRelationDataSchema,
  CreateItemDataSchema,
  extensionForMimeType,
  isSupportedMediaMimeType,
  mediaTypeForMimeType,
  MediaBlobStatusRequestSchema,
  MediaBlobStatusResponseSchema,
  PartialCharacterRelationSchema,
  PartialLocationRelationSchema,
} from '../../index';

describe('relation and media contracts', () => {
  it('rejects self-referential character and location relations while permitting partial patches', () => {
    expect(() => CreateCharacterRelationDataSchema.parse({ character1Id: 'same', character2Id: 'same', relationType: 'siblings' })).toThrow(/identical/i);
    expect(() => CreateLocationRelationDataSchema.parse({ locationAId: 'same', locationBId: 'same', relationType: 'contains' })).toThrow(/identical/i);
    expect(PartialCharacterRelationSchema.parse({ character1Id: 'only-one' })).toEqual({ character1Id: 'only-one' });
    expect(PartialLocationRelationSchema.parse({ locationAId: 'a', locationBId: 'b' })).toEqual({ locationAId: 'a', locationBId: 'b' });
  });

  it('provides null and boolean defaults for item, effect, and gallery creation', () => {
    expect(CreateItemDataSchema.parse({ name: 'Chave' })).toEqual({ name: 'Chave', characterOwnerId: null, category: null, description: null, initialState: null, isFavorite: false, extraNotes: null });
    expect(CreateEffectDataSchema.parse({ entityType: 'Scene', entityId: 'scene-1', effectType: 'triggerSet' })).toEqual({ entityType: 'Scene', entityId: 'scene-1', effectType: 'triggerSet', itemId: null, triggerName: null });
    expect(CreateGalleryDataSchema.parse({ mediaType: 'image', mimeType: 'image/png', fileName: 'nyx.png', hash: 'a'.repeat(32), sizeBytes: 0 })).toMatchObject({ isFavorite: false, title: null, extraNotes: null });
  });

  it('maps supported media types and rejects malformed blob status requests', () => {
    expect(isSupportedMediaMimeType('IMAGE/PNG')).toBe(true);
    expect(isSupportedMediaMimeType('application/pdf')).toBe(false);
    expect(isSupportedMediaMimeType(null)).toBe(false);
    expect(mediaTypeForMimeType('audio/mpeg')).toBe('audio');
    expect(mediaTypeForMimeType('application/pdf')).toBeNull();
    expect(extensionForMimeType('video/quicktime')).toBe('mov');
    expect(extensionForMimeType(undefined)).toBe('bin');
    expect(MediaBlobStatusRequestSchema.parse({ hashes: ['a'.repeat(32)] })).toEqual({ hashes: ['a'.repeat(32)] });
    expect(MediaBlobStatusResponseSchema.parse({ present: ['a'], missing: ['b'] })).toEqual({ present: ['a'], missing: ['b'] });
    expect(() => MediaBlobStatusRequestSchema.parse({ hashes: ['INVALID'] })).toThrow();
  });
});
