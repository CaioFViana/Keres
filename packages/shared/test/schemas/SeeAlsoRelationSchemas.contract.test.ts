import { describe, expect, it } from 'vitest';
import {
  CreateSeeAlsoRelationDataSchema,
  PartialSeeAlsoRelationSchema,
} from '../../schemas/SeeAlsoRelationSchemas';

describe('See-Also relation schemas', () => {
  it('accepts distinct endpoints and rejects self-links in create and complete partial forms', () => {
    expect(
      CreateSeeAlsoRelationDataSchema.safeParse({
        entityAType: 'Character',
        entityAId: 'a',
        entityBType: 'Location',
        entityBId: 'b',
      }).success,
    ).toBe(true);
    expect(
      CreateSeeAlsoRelationDataSchema.safeParse({
        entityAType: 'Character',
        entityAId: 'a',
        entityBType: 'Character',
        entityBId: 'a',
      }).success,
    ).toBe(false);
    expect(
      PartialSeeAlsoRelationSchema.safeParse({
        entityAType: 'Character',
        entityAId: 'a',
        entityBType: 'Character',
        entityBId: 'a',
      }).success,
    ).toBe(false);
    expect(PartialSeeAlsoRelationSchema.safeParse({ entityAType: 'Character' }).success).toBe(true);
  });
});
