import { AttributeType } from '@keres/shared';
import { customAttributeMentionFields } from '../../src/mentions/customAttributeMentions';

const fields = [
  {
    id: 'biography',
    entityType: 'WorldRule' as const,
    type: AttributeType.LONG_TEXT,
    defaultValue: 'Default mentions Alice.',
  },
  {
    id: 'allies',
    entityType: 'WorldRule' as const,
    type: AttributeType.SUGGESTION_LIST,
    defaultValue: null,
  },
  {
    id: 'power',
    entityType: 'WorldRule' as const,
    type: AttributeType.NUMBER,
    defaultValue: null,
  },
  {
    id: 'keeper',
    entityType: 'WorldRule' as const,
    type: AttributeType.ENTITY,
    defaultValue: null,
  },
];

describe('custom attribute mention fields', () => {
  it('includes textual values and expands suggestion lists into readable text', () => {
    expect(
      customAttributeMentionFields('WorldRule', 'rule-1', fields, [
        {
          entityType: 'WorldRule',
          entityId: 'rule-1',
          fieldId: 'biography',
          value: 'Alice learned this rule.',
        },
        {
          entityType: 'WorldRule',
          entityId: 'rule-1',
          fieldId: 'allies',
          value: '["Alice", "Rabbit"]',
        },
        { entityType: 'WorldRule', entityId: 'rule-1', fieldId: 'power', value: '10' },
        { entityType: 'WorldRule', entityId: 'rule-1', fieldId: 'keeper', value: 'character-1' },
      ]),
    ).toEqual({
      'custom:biography': 'Alice learned this rule.',
      'custom:allies': 'Alice\nRabbit',
    });
  });

  it('uses the displayed default when the entity has no value', () => {
    expect(customAttributeMentionFields('WorldRule', 'rule-1', fields, [])).toEqual({
      'custom:biography': 'Default mentions Alice.',
    });
  });

  it('does not mix values belonging to a different entity type or entity', () => {
    expect(
      customAttributeMentionFields('WorldRule', 'rule-1', fields, [
        {
          entityType: 'Character',
          entityId: 'rule-1',
          fieldId: 'biography',
          value: 'Alice is ignored.',
        },
        {
          entityType: 'WorldRule',
          entityId: 'rule-2',
          fieldId: 'biography',
          value: 'Alice is ignored too.',
        },
      ]),
    ).toEqual({ 'custom:biography': 'Default mentions Alice.' });
  });
});
