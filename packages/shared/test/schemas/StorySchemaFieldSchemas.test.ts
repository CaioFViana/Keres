import { describe, expect, it } from 'vitest';
import { AttributeType } from '../../metadata/AttributeType';
import {
  CreateStorySchemaFieldDataSchema,
  PartialStorySchemaFieldSchema,
} from '../../schemas/StorySchemaFieldSchemas';

const baseField = {
  entityType: 'Character' as const,
  name: 'Mentor',
  key: 'mentor',
  type: AttributeType.ENTITY,
};

describe('CreateStorySchemaFieldDataSchema', () => {
  it('accepts an entity attribute with a fixed target and no default', () => {
    const parsed = CreateStorySchemaFieldDataSchema.parse({
      ...baseField,
      targetEntityType: 'Character',
    });

    expect(parsed.targetEntityType).toBe('Character');
    expect(parsed.defaultValue).toBeNull();
  });

  it('enforces entity attribute invariants', () => {
    expect(CreateStorySchemaFieldDataSchema.safeParse(baseField).success).toBe(false);
    expect(
      CreateStorySchemaFieldDataSchema.safeParse({
        ...baseField,
        targetEntityType: 'Character',
        defaultValue: '01HXENTITY',
      }).success,
    ).toBe(false);
    expect(
      CreateStorySchemaFieldDataSchema.safeParse({
        ...baseField,
        type: AttributeType.TEXT,
        targetEntityType: 'Character',
      }).success,
    ).toBe(false);
  });

  it('does not materialize a null target in an unrelated partial update', () => {
    expect(PartialStorySchemaFieldSchema.parse({ name: 'Renamed' })).toEqual({ name: 'Renamed' });
  });
});
