import { describe, expect, it } from 'vitest';
import {
  describeChoiceAnnotations,
  describeChoiceCheck,
  describeEffect,
  interpolateAnnotationLabel,
  type AnnotationCheck,
  type AnnotationCheckGroup,
  type AnnotationEffect,
} from '../../manuscript/choiceAnnotations';

function group(overrides: Partial<AnnotationCheckGroup> = {}): AnnotationCheckGroup {
  return {
    id: 'group-1',
    choiceId: 'choice-1',
    combinator: 'AND',
    order: 1,
    isDeleted: false,
    ...overrides,
  };
}

function check(overrides: Partial<AnnotationCheck> = {}): AnnotationCheck {
  return {
    groupId: 'group-1',
    mode: 'enable',
    type: 'inventory',
    order: 1,
    sceneId: null,
    minVisits: null,
    itemId: 'key',
    itemPresence: 'has',
    triggerName: null,
    triggerState: null,
    isDeleted: false,
    ...overrides,
  };
}

function effect(overrides: Partial<AnnotationEffect> = {}): AnnotationEffect {
  return {
    entityType: 'Choice',
    entityId: 'choice-1',
    effectType: 'itemGrant',
    itemId: 'key',
    triggerName: null,
    isDeleted: false,
    ...overrides,
  };
}

const names = { scenes: {}, items: { key: 'Brass Key' } };

describe('interpolateAnnotationLabel', () => {
  it('replaces every placeholder and empties missing ones', () => {
    expect(
      interpolateAnnotationLabel('Scene "{{scene}}" x{{count}}', { scene: 'A', count: 2 }),
    ).toBe('Scene "A" x2');
    expect(interpolateAnnotationLabel('Hello {{name}}', {})).toBe('Hello ');
  });
});

describe('describeChoiceCheck', () => {
  it('sentences every check type with its block/enable prefix', () => {
    expect(
      describeChoiceCheck(
        check({ type: 'sceneCount', mode: 'block', sceneId: 's', minVisits: 2 }),
        { s: 'Arrival' },
        names.items,
      ),
    ).toBe('Blocks this choice if: Scene "Arrival" has been visited at least 2 time(s)');
    expect(describeChoiceCheck(check(), names.scenes, names.items)).toBe(
      'Enables this choice if: "Brass Key" is in the inventory',
    );
    expect(
      describeChoiceCheck(
        check({ type: 'trigger', triggerName: 'gate', triggerState: 'unset' }),
        names.scenes,
        names.items,
      ),
    ).toBe('Enables this choice if: Trigger "gate" is unset');
  });

  it('falls back to N/A for missing references and clamps visits at one', () => {
    expect(
      describeChoiceCheck(
        check({ type: 'sceneCount', sceneId: 'gone', minVisits: 0 }),
        names.scenes,
        names.items,
      ),
    ).toContain('Scene "N/A" has been visited at least 1 time(s)');
    expect(describeChoiceCheck(check({ itemId: 'gone' }), names.scenes, names.items)).toContain(
      '"N/A" is in the inventory',
    );
  });

  it('returns an empty sentence for unknown check types', () => {
    const unknown = check({
      type: 'unknown-kind',
    } as unknown as Partial<AnnotationCheck>);
    expect(describeChoiceCheck(unknown, names.scenes, names.items)).toBe('');
  });
});

describe('describeEffect', () => {
  it('sentences every effect type', () => {
    expect(describeEffect(effect(), names.items)).toBe('Grants item "Brass Key"');
    expect(describeEffect(effect({ effectType: 'itemTake' }), names.items)).toBe(
      'Takes item "Brass Key"',
    );
    expect(
      describeEffect(effect({ effectType: 'triggerSet', triggerName: 'gate' }), names.items),
    ).toBe('Sets trigger "gate"');
    expect(
      describeEffect(effect({ effectType: 'triggerUnset', triggerName: 'gate' }), names.items),
    ).toBe('Unsets trigger "gate"');
  });

  it('falls back to N/A and stays silent on unknown effect types', () => {
    expect(describeEffect(effect({ itemId: 'gone' }), names.items)).toBe('Grants item "N/A"');
    const unknown = effect({
      effectType: 'unknown-kind',
    } as unknown as Partial<AnnotationEffect>);
    expect(describeEffect(unknown, names.items)).toBe('');
  });
});

describe('describeChoiceAnnotations', () => {
  const input = (overrides: Record<string, unknown> = {}) => ({
    groups: [],
    checks: [],
    effects: [],
    sceneNamesById: {},
    itemNamesById: names.items,
    ...overrides,
  });

  it('returns no entries for choices without checks or effects', () => {
    expect(describeChoiceAnnotations(input())).toEqual(new Map());
    expect(describeChoiceAnnotations(input({ groups: [group()] }))).toEqual(new Map());
  });

  it('describes one check bare, without a group header', () => {
    const annotations = describeChoiceAnnotations(input({ groups: [group()], checks: [check()] }));

    expect(annotations.get('choice-1')).toEqual({
      requirements: ['• Enables this choice if: "Brass Key" is in the inventory'],
      effects: [],
    });
  });

  it('heads groups when the combinator can change the reading', () => {
    const annotations = describeChoiceAnnotations(
      input({
        groups: [group(), group({ id: 'group-2', combinator: 'OR', order: 2 })],
        checks: [check(), check({ groupId: 'group-2' })],
      }),
    );

    expect(annotations.get('choice-1')?.requirements).toEqual([
      'All of the checks below must be true (AND)',
      '• Enables this choice if: "Brass Key" is in the inventory',
      'Any of the checks below must be true (OR)',
      '• Enables this choice if: "Brass Key" is in the inventory',
    ]);
  });

  it('heads a lone group holding several checks', () => {
    const annotations = describeChoiceAnnotations(
      input({
        groups: [group({ combinator: 'OR' })],
        checks: [check(), check({ itemPresence: 'lacks', order: 2 })],
      }),
    );

    expect(annotations.get('choice-1')?.requirements[0]).toBe(
      'Any of the checks below must be true (OR)',
    );
  });

  it('sorts groups and checks explicitly instead of trusting row order', () => {
    const annotations = describeChoiceAnnotations(
      input({
        groups: [
          group({ id: 'group-b', combinator: 'OR', order: 2 }),
          group({ id: 'group-a', combinator: 'AND', order: 1 }),
        ],
        checks: [
          check({ groupId: 'group-b', order: 1 }),
          check({ groupId: 'group-a', order: 1 }),
          check({ groupId: 'group-a', order: 3, itemPresence: 'lacks' }),
          check({ groupId: 'group-a', order: 2, itemId: 'other' }),
        ],
        itemNamesById: { key: 'Brass Key', other: 'Rusty Key' },
      }),
    );

    expect(annotations.get('choice-1')?.requirements).toEqual([
      'All of the checks below must be true (AND)',
      '• Enables this choice if: "Brass Key" is in the inventory',
      '• Enables this choice if: "Rusty Key" is in the inventory',
      '• Enables this choice if: "Brass Key" is not in the inventory',
      'Any of the checks below must be true (OR)',
      '• Enables this choice if: "Brass Key" is in the inventory',
    ]);
  });

  it('skips deleted rows, orphan checks and non-choice effects', () => {
    const annotations = describeChoiceAnnotations(
      input({
        groups: [group(), group({ id: 'group-gone', isDeleted: true })],
        checks: [
          check({ groupId: 'gone' }),
          check({ groupId: 'group-gone' }),
          check({ isDeleted: true }),
        ],
        effects: [
          effect({ entityType: 'Scene', entityId: 'scene-9' }),
          effect({ isDeleted: true }),
        ],
      }),
    );

    expect(annotations).toEqual(new Map());
  });

  it('heads choice effects and skips undescribable rows quietly', () => {
    const annotations = describeChoiceAnnotations(
      input({
        effects: [effect(), effect({ effectType: 'unknown-kind' })],
      }),
    );

    expect(annotations.get('choice-1')).toEqual({
      requirements: [],
      effects: ['Effects', '• Grants item "Brass Key"'],
    });
  });

  it('annotates several choices independently', () => {
    const annotations = describeChoiceAnnotations(
      input({
        groups: [group(), group({ id: 'group-2', choiceId: 'choice-2' })],
        checks: [check(), check({ groupId: 'group-2' })],
        effects: [effect({ entityId: 'choice-2' })],
      }),
    );

    expect(annotations.get('choice-1')).toEqual({
      requirements: ['• Enables this choice if: "Brass Key" is in the inventory'],
      effects: [],
    });
    expect(annotations.get('choice-2')).toEqual({
      requirements: ['• Enables this choice if: "Brass Key" is in the inventory'],
      effects: ['Effects', '• Grants item "Brass Key"'],
    });
  });
});
