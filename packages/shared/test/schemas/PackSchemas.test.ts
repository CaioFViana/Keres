import { describe, expect, it } from 'vitest';
import { AttributeType } from '../../metadata/AttributeType';
import { validatePackContent } from '../../schemas/PackSchemas';

const now = new Date('2026-01-01T00:00:00.000Z');
const row = {
  storyId: 'story-1',
  createdAt: now,
  updatedAt: now,
  version: 1,
  isDeleted: false,
  deletedAt: null,
};

const field = {
  ...row,
  id: 'field-1',
  entityType: 'Character' as const,
  name: 'Origin',
  key: 'origin',
  description: null,
  type: AttributeType.SUGGESTION,
  targetEntityType: null,
  isRequired: false,
  defaultValue: null,
  order: 0,
};

const suggestion = { ...row, id: 'suggestion-1', type: 'custom:field-1', value: 'Forest' };
const stat = { ...row, id: 'stat-1', name: 'Courage', isPrimary: true, order: 0 };
const tier = { ...row, id: 'tier-1', statId: 'stat-1', label: 'Brave', minValue: 10 };

describe('validatePackContent', () => {
  it('accepts references owned by the same pack', () => {
    expect(
      validatePackContent({
        storySchemaFields: [field],
        suggestions: [suggestion],
        stats: [stat],
        statStrengths: [tier],
      }),
    ).toMatchObject({
      storySchemaFields: [expect.objectContaining({ id: 'field-1' })],
      suggestions: [expect.objectContaining({ type: 'custom:field-1' })],
      statStrengths: [expect.objectContaining({ statId: 'stat-1' })],
    });
  });

  it('rejects a custom suggestion whose field is absent', () => {
    expect(() => validatePackContent({ suggestions: [suggestion] })).toThrow(
      'custom suggestion must refer to a field',
    );
  });

  it('rejects a stat tier whose stat is absent', () => {
    expect(() => validatePackContent({ statStrengths: [tier] })).toThrow(
      'stat tier must refer to a stat',
    );
  });
});
