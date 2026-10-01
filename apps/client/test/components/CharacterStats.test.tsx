import { act, fireEvent, render } from '@testing-library/react-native';
import { formatStatNumber, formatStatValueDetailed } from '@keres/shared/graphs/statLadder';
import React from 'react';
import { CharacterStatPanel } from '../../src/components/features/stats/CharacterStatPanel/CharacterStatPanel';
import { CharacterStatValuesEditor } from '../../src/components/features/stats/CharacterStatValuesEditor/CharacterStatValuesEditor';
import { ModeManager } from '../../src/components/features/stats/ModeManager/ModeManager';
import type { StoryStatsData } from '../../src/hooks/useStoryStats';
import { indexStatValues } from '../../src/utils/statValues';
import type { ModeSelect, StatSelect } from '../../src/db/schema';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name }: { name: string }) =>
      ReactActual.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

jest.mock('../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: () => ({ isCompact: true, isMedium: false, isWide: false }),
}));

const mockAlert = jest.fn();
jest.mock('../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    SingleSelectPill: (props: Record<string, any>) =>
      ReactActual.createElement(View, {
        testID: `single-select-${String(props.placeholder ?? 'plain')}`,
        ...props,
      }),
  };
});

jest.mock('../../src/components/common/inputs/TextInput/TextInput', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, any>) =>
      ReactActual.createElement(View, {
        testID: `input-${String(props.placeholder ?? 'plain')}`,
        ...props,
      }),
  };
});

jest.mock('../../src/components/common/controls/Button/Button', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) =>
      ReactActual.createElement(
        Text,
        { testID: `button-${String(children)}`, onPress, disabled },
        children,
      ),
  };
});

jest.mock('../../src/components/common/controls/FormActions/FormActions', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(View, null, children),
  };
});

jest.mock('../../src/components/layout/ResponsiveGrid/ResponsiveGrid', () => {
  const ReactActual = require('react');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
  };
});

const mockRadarProps = { current: null as Record<string, any> | null };
jest.mock('../../src/components/features/stats/StatRadarChart/StatRadarChart', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    StatRadarChart: (props: Record<string, unknown>) => {
      mockRadarProps.current = props as Record<string, any>;
      return ReactActual.createElement(View, { testID: 'stat-radar' });
    },
  };
});

const mockLadderBars: Record<string, any>[] = [];
jest.mock('../../src/components/features/stats/StatLadderBar/StatLadderBar', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    StatLadderBar: (props: Record<string, unknown>) => {
      mockLadderBars.push(props as Record<string, any>);
      return ReactActual.createElement(View, { testID: 'stat-ladder-bar' });
    },
  };
});

const ladder = [
  { label: 'F', minValue: 0 },
  { label: 'C', minValue: 50 },
  { label: 'S', minValue: 100 },
];

const stat = (overrides: Partial<StatSelect> = {}): StatSelect =>
  ({
    id: 'st-1',
    storyId: 'story-1',
    name: 'Might',
    isPrimary: true,
    ...overrides,
  }) as StatSelect;

const mode = (overrides: Partial<ModeSelect> = {}): ModeSelect =>
  ({
    id: 'mode-1',
    storyId: 'story-1',
    characterId: 'c-1',
    name: 'Awakened',
    modeChanges: 'Glowing eyes.',
    ...overrides,
  }) as ModeSelect;

const statsData = (overrides: Partial<StoryStatsData> = {}): StoryStatsData =>
  ({
    characters: [],
    stats: [stat(), stat({ id: 'st-2', name: 'Craft', isPrimary: false })],
    primaryStats: [stat()],
    strengths: [],
    modes: [],
    values: [],
    valueIndex: indexStatValues([{ characterId: 'c-1', modeId: null, statId: 'st-1', value: 80 }]),
    ladderOf: () => ladder,
    defaultLadder: ladder,
    loading: false,
    reload: jest.fn(),
    ...overrides,
  }) as StoryStatsData;

beforeEach(() => {
  jest.clearAllMocks();
  mockRadarProps.current = null;
  mockLadderBars.length = 0;
});

describe('CharacterStatPanel', () => {
  const panelProps = () => ({
    characterId: 'c-1',
    characterName: 'Alice',
    data: statsData(),
    notation: 'letter' as const,
    onCompare: jest.fn(),
    onExport: jest.fn(),
  });

  it('groups the values into primary and secondary rows', async () => {
    const screen = await render(<CharacterStatPanel {...panelProps()} />);

    expect(screen.getByText('stat_primary_section')).toBeTruthy();
    expect(screen.getByText('stat_secondary_section')).toBeTruthy();
    expect(screen.getByText('Might')).toBeTruthy();
    expect(screen.getByText(formatStatValueDetailed(80, ladder, 'letter'))).toBeTruthy();
    expect(screen.getByText('Craft')).toBeTruthy();
  });

  it('says so when the story has no stats', async () => {
    const screen = await render(
      <CharacterStatPanel {...panelProps()} data={statsData({ stats: [], primaryStats: [] })} />,
    );

    expect(screen.getByText('stat_no_values')).toBeTruthy();
  });

  it('marks the values inherited from the normal mode', async () => {
    const props = panelProps();
    props.data = statsData({ modes: [mode()] });
    const screen = await render(<CharacterStatPanel {...props} />);

    await act(async () => {
      screen.getByTestId('single-select-mode_normal').props.onValueChange('mode-1');
    });

    expect(screen.getByText(/stat_inherited/)).toBeTruthy();
  });

  it('offers the character modes, starting from the normal one', async () => {
    const screen = await render(
      <CharacterStatPanel {...panelProps()} data={statsData({ modes: [mode()] })} />,
    );

    const select = screen.getByTestId('single-select-mode_normal');
    expect(select.props.options).toEqual([
      { label: 'mode_normal', value: '' },
      { label: 'Awakened', value: 'mode-1' },
    ]);
    expect(select.props.value).toBe('');
  });

  it('hides the mode selector when the character has no modes', async () => {
    const screen = await render(<CharacterStatPanel {...panelProps()} />);

    expect(screen.queryByTestId('single-select-mode_normal')).toBeNull();
  });

  it('compares and exports the mode being read', async () => {
    const props = panelProps();
    // The export action only shows once the radar has enough primaries for a layout.
    const three = [stat(), stat({ id: 'st-2', name: 'Craft' }), stat({ id: 'st-3', name: 'Wit' })];
    props.data = statsData({ modes: [mode()], stats: three, primaryStats: three });
    const screen = await render(<CharacterStatPanel {...props} />);

    await act(async () => {
      screen.getByTestId('single-select-mode_normal').props.onValueChange('mode-1');
    });

    await fireEvent.press(screen.getByLabelText('stat_compare_title'));
    expect(props.onCompare).toHaveBeenCalledWith('mode-1');

    await fireEvent.press(screen.getByLabelText('stat_export'));
    expect(props.onExport).toHaveBeenCalledWith('mode-1');
  });

  it('hides the actions it was not given', async () => {
    const props = panelProps();
    delete (props as Partial<typeof props>).onCompare;
    delete (props as Partial<typeof props>).onExport;
    const screen = await render(<CharacterStatPanel {...props} />);

    expect(screen.queryByLabelText('stat_compare_title')).toBeNull();
    expect(screen.queryByLabelText('stat_export')).toBeNull();
  });

  it('hands the chart its layout, or the reason there is none', async () => {
    await render(<CharacterStatPanel {...panelProps()} />);

    // A single primary cannot span a radar.
    expect(mockRadarProps.current?.layout).toBeNull();
    expect(mockRadarProps.current?.emptyMessage).toBe('stat_needs_more_primaries');

    const three = [stat(), stat({ id: 'st-2', name: 'Craft' }), stat({ id: 'st-3', name: 'Wit' })];
    await render(
      <CharacterStatPanel
        {...panelProps()}
        data={statsData({ stats: three, primaryStats: three })}
      />,
    );
    expect(mockRadarProps.current?.layout).not.toBeNull();
  });
});

describe('CharacterStatValuesEditor', () => {
  const editorProps = () => ({
    characterId: 'c-1',
    data: statsData(),
    editable: true,
    onSetValue: jest.fn().mockResolvedValue(undefined),
    onClearValue: jest.fn().mockResolvedValue(undefined),
  });

  it('says so when the story has no stats', async () => {
    const screen = await render(
      <CharacterStatValuesEditor {...editorProps()} data={statsData({ stats: [] })} />,
    );

    expect(screen.getByText('stats_empty')).toBeTruthy();
  });

  it('shows the saved values with their tier badges', async () => {
    const screen = await render(<CharacterStatValuesEditor {...editorProps()} />);

    expect(screen.getByText('Might')).toBeTruthy();
    expect(screen.getByText('C')).toBeTruthy();
    const inputs = screen.getAllByTestId('input-stat_value_placeholder');
    expect(inputs[0].props.value).toBe('80');
    expect(mockLadderBars[0]).toMatchObject({ value: 80 });
  });

  it('inherits the normal value in modes without one of their own', async () => {
    const props = editorProps();
    props.data = statsData({ modes: [mode()] });
    const screen = await render(<CharacterStatValuesEditor {...props} />);

    await fireEvent.press(screen.getByText('Awakened').parent!);

    expect(screen.getByText('stat_mode_inherit_hint')).toBeTruthy();
    const inputs = screen.getAllByTestId(/.*/);
    const inherited = inputs.find((node) => node.props.placeholder === formatStatNumber(80));
    expect(inherited?.props.value).toBe('');
  });

  it('writes the typed value on blur and clears on empty', async () => {
    const props = editorProps();
    const screen = await render(<CharacterStatValuesEditor {...props} />);
    const first = () => screen.getAllByTestId('input-stat_value_placeholder')[0];

    await act(async () => {
      first().props.onChangeText('90');
    });
    // The ladder previews the draft before anything is saved.
    expect(mockLadderBars.filter((bar) => bar.value === 90)).toHaveLength(1);
    await act(async () => {
      await first().props.onBlur();
    });
    expect(props.onSetValue).toHaveBeenCalledWith({ modeId: null, statId: 'st-1', value: 90 });

    await act(async () => {
      first().props.onChangeText('  ');
    });
    await act(async () => {
      await first().props.onBlur();
    });
    expect(props.onClearValue).toHaveBeenCalledWith({ modeId: null, statId: 'st-1' });
  });

  it('refuses what is not a number', async () => {
    const props = editorProps();
    const screen = await render(<CharacterStatValuesEditor {...props} />);
    const first = () => screen.getAllByTestId('input-stat_value_placeholder')[0];

    await act(async () => {
      first().props.onChangeText('lots');
    });
    await act(async () => {
      await first().props.onBlur();
    });

    expect(mockAlert).toHaveBeenCalledWith('error', 'stat_tier_value_invalid');
    expect(props.onSetValue).not.toHaveBeenCalled();
  });

  it('reports a save that fails', async () => {
    const props = editorProps();
    props.onSetValue.mockRejectedValue(new Error('disk full'));
    const silence = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const screen = await render(<CharacterStatValuesEditor {...props} />);
    const first = () => screen.getAllByTestId('input-stat_value_placeholder')[0];

    await act(async () => {
      first().props.onChangeText('90');
    });
    await act(async () => {
      await first().props.onBlur();
    });

    expect(mockAlert).toHaveBeenCalledWith('error', 'disk full');
    silence.mockRestore();
  });

  it('locks the fields when read-only', async () => {
    const screen = await render(<CharacterStatValuesEditor {...editorProps()} editable={false} />);

    for (const input of screen.getAllByTestId('input-stat_value_placeholder')) {
      expect(input.props.editable).toBe(false);
    }
  });
});

describe('ModeManager', () => {
  const managerProps = () => ({
    modes: [mode()],
    editable: true,
    onCreate: jest.fn().mockResolvedValue(undefined),
    onUpdate: jest.fn().mockResolvedValue(undefined),
    onDelete: jest.fn().mockResolvedValue(undefined),
  });

  it('counts its modes and shows their changes', async () => {
    const screen = await render(<ModeManager {...managerProps()} />);

    expect(screen.getByText('modes_title (1)')).toBeTruthy();
    expect(screen.getByText('Awakened')).toBeTruthy();
    expect(screen.getByText('Glowing eyes.')).toBeTruthy();
  });

  it('shows the empty state when there are no modes', async () => {
    const screen = await render(<ModeManager {...managerProps()} modes={[]} />);

    expect(screen.getByText('modes_empty')).toBeTruthy();
  });

  it('creates the mode it is told', async () => {
    const props = managerProps();
    const screen = await render(<ModeManager {...props} />);

    await act(async () => {
      screen.getByTestId('input-mode_name_placeholder').props.onChangeText('  Ascended  ');
      screen.getByTestId('input-mode_changes_placeholder').props.onChangeText('Wings.');
    });
    await fireEvent.press(screen.getByTestId('button-modes_add'));

    expect(props.onCreate).toHaveBeenCalledWith({ name: 'Ascended', modeChanges: 'Wings.' });
    // The form starts over after a creation.
    expect(screen.getByTestId('input-mode_name_placeholder').props.value).toBe('');
  });

  it('stores blank changes as no changes', async () => {
    const props = managerProps();
    const screen = await render(<ModeManager {...props} />);

    await act(async () => {
      screen.getByTestId('input-mode_name_placeholder').props.onChangeText('Plain');
    });
    await fireEvent.press(screen.getByTestId('button-modes_add'));

    expect(props.onCreate).toHaveBeenCalledWith({ name: 'Plain', modeChanges: null });
  });

  it('refuses a mode without a name', async () => {
    const props = managerProps();
    const screen = await render(<ModeManager {...props} />);

    await act(async () => {
      screen.getByTestId('input-mode_name_placeholder').props.onChangeText('   ');
    });
    await fireEvent.press(screen.getByTestId('button-modes_add'));

    expect(mockAlert).toHaveBeenCalledWith('error', 'mode_name_required');
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it('edits a mode in place and cancels back', async () => {
    const props = managerProps();
    const screen = await render(<ModeManager {...props} />);

    await fireEvent.press(screen.getByLabelText('mode_edit'));
    expect(screen.getByTestId('input-mode_name_placeholder').props.value).toBe('Awakened');

    await act(async () => {
      screen.getByTestId('input-mode_name_placeholder').props.onChangeText('Awakened+');
    });
    await fireEvent.press(screen.getByTestId('button-save'));

    expect(props.onUpdate).toHaveBeenCalledWith('mode-1', {
      name: 'Awakened+',
      modeChanges: 'Glowing eyes.',
    });

    await fireEvent.press(screen.getByLabelText('mode_edit'));
    await fireEvent.press(screen.getByTestId('button-cancel'));
    expect(screen.getByTestId('input-mode_name_placeholder').props.value).toBe('');
  });

  it('deletes only after the confirmation', async () => {
    const props = managerProps();
    const screen = await render(<ModeManager {...props} />);

    await fireEvent.press(screen.getByLabelText('delete'));
    expect(mockAlert).toHaveBeenCalledWith(
      'mode_delete_title',
      'mode_delete_message',
      expect.any(Array),
      { cancelable: true },
    );

    await act(async () => {
      await mockAlert.mock.calls[0][2][1].onPress();
    });
    expect(props.onDelete).toHaveBeenCalledWith('mode-1');
  });

  it('hides the authoring controls when read-only', async () => {
    const screen = await render(<ModeManager {...managerProps()} editable={false} />);

    expect(screen.queryByTestId('button-modes_add')).toBeNull();
    expect(screen.queryByLabelText('mode_edit')).toBeNull();
    expect(screen.queryByLabelText('delete')).toBeNull();
  });
});
