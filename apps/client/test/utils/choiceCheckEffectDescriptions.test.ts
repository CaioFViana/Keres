import { describeChoiceCheck, describeEffect } from '../../src/utils/choiceCheckEffectDescriptions';
import type { TFunction } from 'i18next';

const t = (key: string, values: Record<string, unknown> = {}) =>
  `${key}:${Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join(',')}`;
const translate = t as unknown as TFunction;

describe('choice check and effect descriptions', () => {
  it('describes every check type and retains its block/enable meaning', () => {
    expect(
      describeChoiceCheck(
        { type: 'sceneCount', mode: 'block', sceneId: 's', minVisits: 2 } as never,
        { s: 'Arrival' },
        {},
        translate,
      ),
    ).toContain('check_condition_prefix_block');
    expect(
      describeChoiceCheck(
        { type: 'inventory', mode: 'enable', itemId: 'key', itemPresence: 'lacks' } as never,
        {},
        { key: 'Key' },
        translate,
      ),
    ).toContain('check_condition_inventory_lacks');
    expect(
      describeChoiceCheck(
        { type: 'trigger', mode: 'enable', triggerName: 'gate', triggerState: 'unset' } as never,
        {},
        {},
        translate,
      ),
    ).toContain('check_condition_trigger_unset');
  });

  it('uses a safe not-applicable label for missing referenced entities and describes all effects', () => {
    expect(
      describeEffect({ effectType: 'itemGrant', itemId: 'gone' } as never, {}, translate),
    ).toContain('common_na');
    expect(
      describeEffect({ effectType: 'itemTake', itemId: 'key' } as never, { key: 'Key' }, translate),
    ).toContain('effect_description_item_take');
    expect(
      describeEffect({ effectType: 'triggerSet', triggerName: 'gate' } as never, {}, translate),
    ).toContain('effect_description_trigger_set');
    expect(
      describeEffect({ effectType: 'triggerUnset', triggerName: null } as never, {}, translate),
    ).toContain('common_na');
  });
});
