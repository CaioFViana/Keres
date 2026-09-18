import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import type { ChoiceCheck } from '@keres/shared/entities/ChoiceCheck';
import type { ChoiceCheckGroup } from '@keres/shared/entities/ChoiceCheckGroup';
import type { Effect } from '@keres/shared/entities/Effect';
import React from 'react';
import ChoiceCheckGroupEditor from '../../src/components/features/choices/ChoiceCheckGroupEditor';
import EffectListEditor from '../../src/components/features/effects/EffectListEditor';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
      primary: '#00f',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../src/components/layout/ScreenSection/ScreenSection', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ title }: { title: React.ReactNode }) => <RN.Text>{title}</RN.Text>,
  };
});

/** A dropdown reduced to what the editors read from it: its value, and a way to change it. */
jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    SingleSelectPill: ({
      options,
      value,
      onValueChange,
      placeholder,
    }: {
      options: { label: string; value: string }[];
      value: string | null;
      onValueChange: (next: string | null) => void;
      placeholder?: string;
    }) => (
      <RN.View
        testID="single-select-pill"
        options={options}
        value={value}
        onValueChange={onValueChange}
        placeholder={placeholder}
      />
    ),
  };
});

/** The add/remove links carry no accessibility labels, so press through their text. */
async function pressText(view: RenderResult, text: string) {
  await fireEvent.press(view.getByText(text));
}

async function setPill(view: RenderResult, index: number, value: string | null) {
  await act(async () => {
    view.getAllByTestId('single-select-pill')[index].props.onValueChange(value);
  });
}

beforeEach(() => jest.clearAllMocks());

const group = (overrides: Partial<ChoiceCheckGroup> = {}): ChoiceCheckGroup =>
  ({ id: 'group-1', combinator: 'AND', ...overrides }) as ChoiceCheckGroup;

const check = (overrides: Partial<ChoiceCheck> = {}): ChoiceCheck =>
  ({
    id: 'check-1',
    groupId: 'group-1',
    mode: 'block',
    type: 'sceneCount',
    sceneId: null,
    minVisits: null,
    itemId: null,
    itemPresence: null,
    triggerName: null,
    triggerState: null,
    ...overrides,
  }) as ChoiceCheck;

describe('ChoiceCheckGroupEditor', () => {
  const options = {
    combinatorOptions: [
      { label: 'All', value: 'AND' },
      { label: 'Any', value: 'OR' },
    ],
    checkTypeOptions: [
      { label: 'Scene', value: 'sceneCount' },
      { label: 'Inventory', value: 'inventory' },
      { label: 'Trigger', value: 'trigger' },
    ],
    checkModeOptions: [
      { label: 'Block', value: 'block' },
      { label: 'Enable', value: 'enable' },
    ],
    sceneOptions: [{ label: 'Arrival', value: 'scene-1' }],
    itemOptions: [{ label: 'Torch', value: 'item-1' }],
    itemPresenceOptions: [
      { label: 'Has', value: 'has' },
      { label: 'Lacks', value: 'lacks' },
    ],
    triggerStateOptions: [
      { label: 'Set', value: 'set' },
      { label: 'Unset', value: 'unset' },
    ],
  };

  const baseProps = {
    ...options,
    scenePlaceholder: 'Pick a scene',
    inputStyle: {},
    onUpdateCombinator: jest.fn(),
    onDeleteGroup: jest.fn(),
    onAddGroup: jest.fn(),
    onChangeCheckType: jest.fn(),
    onUpdateCheck: jest.fn(),
    onDeleteCheck: jest.fn(),
    onAddCheck: jest.fn(),
  };

  it('invites the first group when there are none', async () => {
    const onAddGroup = jest.fn();
    const view = await render(
      <ChoiceCheckGroupEditor
        {...baseProps}
        checkGroups={[]}
        checks={[]}
        onAddGroup={onAddGroup}
      />,
    );

    expect(view.getByText('checks_title')).toBeTruthy();
    expect(view.getByText('checks_groups_and_note')).toBeTruthy();
    expect(view.getByText('no_check_groups')).toBeTruthy();
    await pressText(view, 'add_check_group');
    expect(onAddGroup).toHaveBeenCalledTimes(1);
  });

  it('updates and deletes a group', async () => {
    const onUpdateCombinator = jest.fn();
    const onDeleteGroup = jest.fn();
    const view = await render(
      <ChoiceCheckGroupEditor
        {...baseProps}
        checkGroups={[group()]}
        checks={[]}
        onUpdateCombinator={onUpdateCombinator}
        onDeleteGroup={onDeleteGroup}
      />,
    );

    expect(view.getByText('no_checks_in_group')).toBeTruthy();
    await setPill(view, 0, 'OR');
    expect(onUpdateCombinator).toHaveBeenCalledWith('group-1', 'OR');
    await pressText(view, 'remove_check_group');
    expect(onDeleteGroup).toHaveBeenCalledWith('group-1');
    await pressText(view, 'add_check');
    expect(baseProps.onAddCheck).toHaveBeenCalledWith('group-1');
  });

  it('edits a scene-count check', async () => {
    const onChangeCheckType = jest.fn();
    const onUpdateCheck = jest.fn();
    const view = await render(
      <ChoiceCheckGroupEditor
        {...baseProps}
        checkGroups={[group()]}
        checks={[check({ minVisits: 2 })]}
        onChangeCheckType={onChangeCheckType}
        onUpdateCheck={onUpdateCheck}
      />,
    );

    // Pills: combinator, type, mode, scene.
    await setPill(view, 1, 'inventory');
    expect(onChangeCheckType).toHaveBeenCalledWith('check-1', 'inventory');
    await setPill(view, 2, 'enable');
    expect(onUpdateCheck).toHaveBeenCalledWith('check-1', { mode: 'enable' });
    await setPill(view, 3, 'scene-1');
    expect(onUpdateCheck).toHaveBeenCalledWith('check-1', { sceneId: 'scene-1' });

    await fireEvent.changeText(view.getByPlaceholderText('check_min_visits_placeholder'), '3');
    expect(onUpdateCheck).toHaveBeenCalledWith('check-1', { minVisits: 3 });
    await fireEvent.changeText(view.getByPlaceholderText('check_min_visits_placeholder'), '');
    expect(onUpdateCheck).toHaveBeenCalledWith('check-1', { minVisits: null });
  });

  it('edits an inventory check', async () => {
    const onUpdateCheck = jest.fn();
    const view = await render(
      <ChoiceCheckGroupEditor
        {...baseProps}
        checkGroups={[group()]}
        checks={[check({ id: 'check-2', type: 'inventory' })]}
        onUpdateCheck={onUpdateCheck}
      />,
    );

    // Pills: combinator, type, mode, item, presence.
    await setPill(view, 3, 'item-1');
    expect(onUpdateCheck).toHaveBeenCalledWith('check-2', { itemId: 'item-1' });
    await setPill(view, 4, 'lacks');
    expect(onUpdateCheck).toHaveBeenCalledWith('check-2', { itemPresence: 'lacks' });
  });

  it('edits a trigger check and deletes it', async () => {
    const onUpdateCheck = jest.fn();
    const onDeleteCheck = jest.fn();
    const view = await render(
      <ChoiceCheckGroupEditor
        {...baseProps}
        checkGroups={[group()]}
        checks={[check({ id: 'check-3', type: 'trigger', triggerName: 'met_ari' })]}
        onUpdateCheck={onUpdateCheck}
        onDeleteCheck={onDeleteCheck}
      />,
    );

    await fireEvent.changeText(
      view.getByPlaceholderText('check_trigger_name_placeholder'),
      'met_bex',
    );
    expect(onUpdateCheck).toHaveBeenCalledWith('check-3', { triggerName: 'met_bex' });
    await fireEvent.changeText(view.getByPlaceholderText('check_trigger_name_placeholder'), '');
    expect(onUpdateCheck).toHaveBeenCalledWith('check-3', { triggerName: null });
    // Pills: combinator, type, mode, trigger state.
    await setPill(view, 3, 'unset');
    expect(onUpdateCheck).toHaveBeenCalledWith('check-3', { triggerState: 'unset' });

    await pressText(view, 'remove_check');
    expect(onDeleteCheck).toHaveBeenCalledWith('check-3');
  });

  it('ignores an empty pill choice', async () => {
    const onUpdateCombinator = jest.fn();
    const view = await render(
      <ChoiceCheckGroupEditor
        {...baseProps}
        checkGroups={[group()]}
        checks={[]}
        onUpdateCombinator={onUpdateCombinator}
      />,
    );

    await setPill(view, 0, null);
    expect(onUpdateCombinator).not.toHaveBeenCalled();
  });
});

describe('EffectListEditor', () => {
  const itemOptions = [{ label: 'Torch', value: 'item-1' }];

  const baseProps = {
    itemOptions,
    itemLabel: 'Item',
    inputStyle: {},
    onChangeType: jest.fn(),
    onUpdate: jest.fn(),
    onDelete: jest.fn(),
    onAdd: jest.fn(),
  };

  const effect = (
    overrides: Partial<Effect> = {},
  ): Pick<Effect, 'id' | 'effectType' | 'itemId' | 'triggerName'> => ({
    id: 'effect-1',
    effectType: 'itemGrant',
    itemId: null,
    triggerName: null,
    ...overrides,
  });

  it('invites the first effect when there are none', async () => {
    const onAdd = jest.fn();
    const view = await render(<EffectListEditor {...baseProps} effects={[]} onAdd={onAdd} />);

    expect(view.getByText('effects_title')).toBeTruthy();
    expect(view.getByText('no_effects')).toBeTruthy();
    await pressText(view, 'add_effect');
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('falls back to the four built-in effect types', async () => {
    const view = await render(<EffectListEditor {...baseProps} effects={[effect()]} />);

    expect(view.getAllByTestId('single-select-pill')[0].props.options).toEqual([
      { label: 'effect_type_item_grant', value: 'itemGrant' },
      { label: 'effect_type_item_take', value: 'itemTake' },
      { label: 'effect_type_trigger_set', value: 'triggerSet' },
      { label: 'effect_type_trigger_unset', value: 'triggerUnset' },
    ]);
  });

  it('changes the type and deletes the effect', async () => {
    const onChangeType = jest.fn();
    const onDelete = jest.fn();
    const view = await render(
      <EffectListEditor
        {...baseProps}
        effects={[effect()]}
        onChangeType={onChangeType}
        onDelete={onDelete}
      />,
    );

    await setPill(view, 0, 'triggerSet');
    expect(onChangeType).toHaveBeenCalledWith('effect-1', 'triggerSet');
    await pressText(view, 'remove_effect');
    expect(onDelete).toHaveBeenCalledWith('effect-1');
  });

  it('picks the item for grant and take effects', async () => {
    const onUpdate = jest.fn();
    const view = await render(
      <EffectListEditor
        {...baseProps}
        effects={[effect({ id: 'effect-2', effectType: 'itemTake', itemId: 'item-1' })]}
        onUpdate={onUpdate}
      />,
    );

    const [, itemPill] = view.getAllByTestId('single-select-pill');
    expect(itemPill.props.placeholder).toBe('select_item');
    expect(itemPill.props.value).toBe('item-1');
    await act(async () => {
      itemPill.props.onValueChange(null);
    });
    expect(onUpdate).toHaveBeenCalledWith('effect-2', { itemId: null });
  });

  it('names the trigger for set and unset effects', async () => {
    const onUpdate = jest.fn();
    const view = await render(
      <EffectListEditor
        {...baseProps}
        effects={[effect({ id: 'effect-3', effectType: 'triggerUnset', triggerName: 'met_ari' })]}
        onUpdate={onUpdate}
      />,
    );

    await fireEvent.changeText(
      view.getByPlaceholderText('check_trigger_name_placeholder'),
      'met_bex',
    );
    expect(onUpdate).toHaveBeenCalledWith('effect-3', { triggerName: 'met_bex' });
    await fireEvent.changeText(view.getByPlaceholderText('check_trigger_name_placeholder'), '');
    expect(onUpdate).toHaveBeenCalledWith('effect-3', { triggerName: null });
  });
});
