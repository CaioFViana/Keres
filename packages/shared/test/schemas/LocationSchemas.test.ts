import { describe, expect, it } from 'vitest';
import { LOCATION_INT_EXT } from '../../entities/Location';
import { CreateLocationDataSchema, LocationSchema } from '../../schemas/LocationSchemas';

const row = {
  id: 'loc-1',
  storyId: 'story-1',
  name: 'Kitchen',
  description: null,
  climate: null,
  culture: null,
  politics: null,
  isFavorite: false,
  extraNotes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  isDeleted: false,
  deletedAt: null,
};

const created = {
  name: 'Kitchen',
  description: null,
  climate: null,
  culture: null,
  politics: null,
  extraNotes: null,
};

describe('Location interior / exterior', () => {
  it('defaults to none for a row written before the field existed', () => {
    expect(LocationSchema.parse(row).intExt).toBeNull();
    expect(CreateLocationDataSchema.parse(created).intExt).toBeNull();
  });

  it('accepts interior, exterior and both, and refuses anything else', () => {
    for (const intExt of LOCATION_INT_EXT) {
      expect(CreateLocationDataSchema.parse({ ...created, intExt }).intExt).toBe(intExt);
    }
    expect(() => CreateLocationDataSchema.parse({ ...created, intExt: 'underwater' })).toThrow();
  });
});
