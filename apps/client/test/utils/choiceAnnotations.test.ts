import type { TFunction } from 'i18next';
import { DEFAULT_CHOICE_ANNOTATION_LABELS } from '@keres/shared';
import en from '../../src/locales/en.json';
import { describeChoiceAnnotations } from '../../src/utils/choiceAnnotations';
import { CHOICE_ANNOTATION_LABEL_KEYS } from '../../src/utils/choiceCheckEffectDescriptions';

const t = (key: string, values: Record<string, unknown> = {}) =>
  `${key}:${Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join(',')}`;
const translate = t as unknown as TFunction;

const group = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'group-1',
    storyId: 'story-1',
    choiceId: 'choice-1',
    combinator: 'AND',
    order: 1,
    ...overrides,
  }) as never;

const check = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'check-1',
    storyId: 'story-1',
    groupId: 'group-1',
    mode: 'enable',
    type: 'inventory',
    order: 1,
    itemId: 'key',
    itemPresence: 'has',
    ...overrides,
  }) as never;

const effect = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'effect-1',
    storyId: 'story-1',
    entityType: 'Choice',
    entityId: 'choice-1',
    effectType: 'itemGrant',
    itemId: 'key',
    ...overrides,
  }) as never;

const input = (overrides: Record<string, unknown> = {}) => ({
  groups: [],
  checks: [],
  effects: [],
  sceneNamesById: {},
  itemNamesById: { key: 'Brass Key' },
  t: translate,
  ...overrides,
});

describe('describeChoiceAnnotations', () => {
  it('returns no entries for choices without checks or effects', () => {
    expect(describeChoiceAnnotations(input())).toEqual(new Map());
    expect(
      describeChoiceAnnotations(input({ groups: [group()], checks: [], effects: [] })),
    ).toEqual(new Map());
  });

  it('describes one check bare, without a group header', () => {
    const annotations = describeChoiceAnnotations(input({ groups: [group()], checks: [check()] }));

    expect(annotations.get('choice-1')).toEqual({
      requirements: [
        '• check_condition_prefix_enable: check_condition_inventory_has:item=Brass Key',
      ],
      effects: [],
    });
  });

  it('heads groups when the combinator can change the reading', () => {
    const annotations = describeChoiceAnnotations(
      input({
        groups: [group(), group({ id: 'group-2', combinator: 'OR', order: 2 })],
        checks: [check(), check({ id: 'check-2', groupId: 'group-2' })],
        effects: [],
      }),
    );

    expect(annotations.get('choice-1')?.requirements).toEqual([
      'check_group_combinator_and_label:',
      expect.stringContaining('check_condition_inventory_has'),
      'check_group_combinator_or_label:',
      expect.stringContaining('check_condition_inventory_has'),
    ]);
  });

  it('heads a lone group holding several checks', () => {
    const annotations = describeChoiceAnnotations(
      input({
        groups: [group({ combinator: 'OR' })],
        checks: [check(), check({ id: 'check-2', order: 2, itemPresence: 'lacks' })],
        effects: [],
      }),
    );

    expect(annotations.get('choice-1')?.requirements[0]).toBe('check_group_combinator_or_label:');
  });

  it('sorts groups by order across interleaved service rows', () => {
    const annotations = describeChoiceAnnotations(
      input({
        groups: [
          group({ id: 'group-b', combinator: 'OR', order: 2 }),
          group({ id: 'group-a', combinator: 'AND', order: 1 }),
        ],
        // Global service order, not grouped: the export still reads group by group.
        checks: [
          check({ id: 'check-b', groupId: 'group-b', order: 1 }),
          check({ id: 'check-a', groupId: 'group-a', order: 1 }),
        ],
        effects: [],
      }),
    );

    expect(annotations.get('choice-1')?.requirements).toEqual([
      'check_group_combinator_and_label:',
      expect.any(String),
      'check_group_combinator_or_label:',
      expect.any(String),
    ]);
  });

  it('drops checks whose group is gone and effects of other entities', () => {
    const annotations = describeChoiceAnnotations(
      input({
        groups: [group()],
        checks: [check({ groupId: 'gone' })],
        effects: [effect({ entityType: 'Scene', entityId: 'scene-9' })],
      }),
    );

    expect(annotations).toEqual(new Map());
  });

  it('heads choice effects and skips undescribable rows quietly', () => {
    const annotations = describeChoiceAnnotations(
      input({
        groups: [],
        checks: [],
        effects: [effect(), effect({ id: 'effect-2', effectType: 'unknown-kind' })],
      }),
    );

    expect(annotations.get('choice-1')).toEqual({
      requirements: [],
      effects: ['effects_title:', '• effect_description_item_grant:item=Brass Key'],
    });
  });

  it('keeps the shared English defaults verbatim with the client catalog', () => {
    // The API publishes manuscripts with these defaults; any drift changes published
    // documents. Update both sides together, never one.
    for (const [name, key] of Object.entries(CHOICE_ANNOTATION_LABEL_KEYS)) {
      expect(
        DEFAULT_CHOICE_ANNOTATION_LABELS[name as keyof typeof DEFAULT_CHOICE_ANNOTATION_LABELS],
      ).toBe((en as Record<string, string>)[key]);
    }
  });

  it('annotates several choices independently', () => {
    const annotations = describeChoiceAnnotations(
      input({
        groups: [group(), group({ id: 'group-2', choiceId: 'choice-2' })],
        checks: [check(), check({ id: 'check-2', groupId: 'group-2' })],
        effects: [effect({ entityId: 'choice-2' })],
      }),
    );

    expect(annotations.get('choice-1')).toEqual({
      requirements: [expect.stringContaining('check_condition_inventory_has')],
      effects: [],
    });
    expect(annotations.get('choice-2')?.effects[0]).toBe('effects_title:');
  });
});
