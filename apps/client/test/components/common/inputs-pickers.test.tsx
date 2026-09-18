import {
  formatAttributeDateForDisplay,
  formatCalendarDate,
  partsToDayNumber,
  themeDisplayOptions,
  type CalendarDefinitionType,
} from '@keres/shared';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import ColorPickerInput from '../../../src/components/common/inputs/ColorPickerInput/ColorPickerInput';
import ColorPickerModal from '../../../src/components/common/inputs/ColorPickerInput/ColorPickerModal';
import IconPickerInput from '../../../src/components/common/inputs/IconPickerInput/IconPickerInput';
import IconPickerModal from '../../../src/components/common/inputs/IconPickerInput/IconPickerModal';
import DatePickerInput from '../../../src/components/common/inputs/DatePickerInput/DatePickerInput';
import StoryDateInput from '../../../src/components/common/inputs/StoryDateInput/StoryDateInput';
import ThemePickerModal from '../../../src/components/common/inputs/ThemePickerModal/ThemePickerModal';
import { useStoryCalendar } from '../../../src/hooks/useStoryCalendar';

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({
      isDarkMode: false,
      colors: {
        primary: '#0000ff',
        primaryContainer: '#ddddff',
        onPrimary: '#ffffff',
        onPrimaryContainer: '#000088',
        secondary: '#00aaaa',
        onSecondary: '#ffffff',
        background: '#ffffff',
        surface: '#f5f5f5',
        card: '#eeeeee',
        onSurface: '#111111',
        text: '#111111',
        textSecondary: '#555555',
        border: '#dddddd',
        error: '#ff0000',
        onError: '#ffffff',
        accent: '#00ff00',
        onAccent: '#001100',
        notification: '#ffaa00',
        onNotification: '#221100',
        shadow: '#000000',
      },
    }),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Icon',
  MaterialCommunityIcons: 'MIcon',
}));

jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));

jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({
    width: 390,
    height: 844,
    breakpoint: 'compact',
    isCompact: true,
    isMedium: false,
    isWide: false,
  }),
}));

jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector: (state: { use24HourTime: boolean }) => boolean) =>
    selector({ use24HourTime: true }),
}));

jest.mock('../../../src/hooks/useStoryCalendar', () => ({
  useStoryCalendar: jest.fn(() => ({ definition: null })),
}));

jest.mock('../../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: ({ visible, children }: any) =>
      visible ? react.createElement(react.Fragment, null, children) : null,
  };
});

jest.mock('../../../src/components/common/inputs/DatePickerInput/DatePickerModal', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ value, onSelect, onClose, title }: any) =>
      react.createElement(
        react.Fragment,
        null,
        react.createElement(native.Text, { testID: 'dp-stub' }, `${title}=${value ?? 'none'}`),
        react.createElement(
          native.Text,
          { testID: 'dp-select', onPress: () => onSelect('2024-02-03') },
          'dp-pick',
        ),
        react.createElement(native.Text, { testID: 'dp-close', onPress: onClose }, 'dp-close'),
      ),
  };
});

const mockStoryCalendar = useStoryCalendar as jest.Mock;

const pressIcon = async (screen: Awaited<ReturnType<typeof render>>, name: string) => {
  const icons = screen.container.queryAll(
    (node) => node.type === 'Icon' && node.props.name === name,
  );
  expect(icons.length).toBeGreaterThan(0);
  await fireEvent.press(icons[0]);
};

describe('ColorPickerInput', () => {
  it('shows the current color and confirms a picked one', async () => {
    const onSelectColor = jest.fn();
    const screen = await render(
      <ColorPickerInput
        currentColor="#ff0000"
        onSelectColor={onSelectColor}
        placeholder="Pick a color"
      />,
    );

    const field = screen.container.queryAll((node) => node.type === 'TextInput')[0];
    expect(field.props.value).toBe('#ff0000');
    await pressIcon(screen, 'color-palette');
    expect(screen.getByText('Pick a color')).toBeTruthy();
    expect(screen.getByText('#FF0000')).toBeTruthy();

    // A standard swatch is the only circle with the grid margin.
    const swatches = screen.container.queryAll(
      (node) => StyleSheet.flatten(node.props.style)?.margin === 2.5,
    );
    expect(swatches.length).toBe(32);
    await fireEvent.press(swatches[0]);
    const previewText = screen.getByText(/#[0-9A-F]{6}/).props.children as string;
    await fireEvent.press(screen.getByText('select'));
    expect(onSelectColor).toHaveBeenCalledWith(previewText.toLowerCase());
    expect(screen.queryByText(/#[0-9A-F]{6}/)).toBeNull();
  });

  it('cancels without selecting', async () => {
    const onSelectColor = jest.fn();
    const screen = await render(
      <ColorPickerInput currentColor="#ff0000" onSelectColor={onSelectColor} />,
    );

    await pressIcon(screen, 'color-palette');
    await fireEvent.press(screen.getByText('cancel'));
    expect(onSelectColor).not.toHaveBeenCalled();
    expect(screen.queryByText(/#[0-9A-F]{6}/)).toBeNull();
  });

  it('shows the placeholder treatment without a current color', async () => {
    const screen = await render(
      <ColorPickerInput currentColor="" onSelectColor={() => {}} placeholder="Accent" />,
    );

    const field = screen.container.queryAll((node) => node.type === 'TextInput')[0];
    expect(field.props.placeholder).toBe('Accent');
    expect(
      screen.container.queryAll(
        (node) => node.type === 'Icon' && node.props.name === 'color-palette-outline',
      ),
    ).toHaveLength(1);
  });
});

describe('ColorPickerModal', () => {
  it('selects the derived color and cancels cleanly', async () => {
    const onSelectColor = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <ColorPickerModal currentColor="#00ff00" onSelectColor={onSelectColor} onClose={onClose} />,
    );

    expect(screen.queryByText('Pick a color')).toBeNull();
    await fireEvent.press(screen.getByText('select'));
    expect(onSelectColor).toHaveBeenCalledWith('#00ff00');
    await fireEvent.press(screen.getByText('cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('IconPickerInput', () => {
  const options = ['planet', 'star'] as never[];

  it('opens the grid and confirms an icon', async () => {
    const onSelectIcon = jest.fn();
    const screen = await render(
      <IconPickerInput
        currentIcon={null}
        onSelectIcon={onSelectIcon}
        placeholder="Avatar icon"
        iconOptions={options}
      />,
    );

    expect(screen.getByText('Avatar icon')).toBeTruthy();
    await pressIcon(screen, 'help-outline');
    // The placeholder labels both the field and the open modal.
    expect(screen.getAllByText('Avatar icon')).toHaveLength(2);
    await pressIcon(screen, 'planet');
    expect(onSelectIcon).toHaveBeenCalledWith('planet');
  });

  it('shows the current icon and cancels without selecting', async () => {
    const onSelectIcon = jest.fn();
    const screen = await render(
      <IconPickerInput
        currentIcon="star"
        onSelectIcon={onSelectIcon}
        placeholder="Avatar icon"
        iconOptions={options}
      />,
    );

    expect(screen.getByText('star')).toBeTruthy();
    await pressIcon(screen, 'star');
    await fireEvent.press(screen.getByText('cancel'));
    expect(onSelectIcon).not.toHaveBeenCalled();
    expect(screen.queryByText('Avatar icon')).toBeNull();
  });
});

describe('IconPickerModal', () => {
  const options = ['planet', 'star', 'moon'] as never[];

  it('marks the current icon and selects on press', async () => {
    const onSelectIcon = jest.fn();
    const screen = await render(
      <IconPickerModal
        currentIcon="star"
        onSelectIcon={onSelectIcon}
        onClose={() => {}}
        title="Pick one"
        options={options}
      />,
    );

    expect(screen.getByText('Pick one')).toBeTruthy();
    const cellOf = (name: string) =>
      screen.container.queryAll((node) => node.type === 'Icon' && node.props.name === name)[0]
        .parent;
    expect(StyleSheet.flatten(cellOf('star')?.props.style).borderColor).toBe('#0000ff');
    expect(StyleSheet.flatten(cellOf('planet')?.props.style).borderColor).toBe('#dddddd');
    await pressIcon(screen, 'planet');
    expect(onSelectIcon).toHaveBeenCalledWith('planet');
  });

  it('closes through the cancel button', async () => {
    const onClose = jest.fn();
    const screen = await render(
      <IconPickerModal
        currentIcon={null}
        onSelectIcon={() => {}}
        onClose={onClose}
        options={options}
      />,
    );

    await fireEvent.press(screen.getByText('cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('DatePickerInput', () => {
  it('displays the formatted date, not the canonical value', async () => {
    const screen = await render(
      <DatePickerInput value="2024-05-06" onChange={() => {}} placeholder="Birthday" />,
    );

    const field = screen.getByTestId('date-picker-value');
    expect(field.props.value).toBe(formatAttributeDateForDisplay('2024-05-06', 'en', true));
    expect(field.props.value).not.toBe('2024-05-06');
  });

  it('shows legacy values raw and the default placeholder when empty', async () => {
    const legacy = await render(<DatePickerInput value="someday" onChange={() => {}} />);
    expect(legacy.getByTestId('date-picker-value').props.value).toBe('someday');

    const empty = await render(<DatePickerInput value={null} onChange={() => {}} />);
    const field = empty.getByTestId('date-picker-value');
    expect(field.props.value).toBe('');
    expect(field.props.placeholder).toBe('attribute_date_select_placeholder');
    expect(
      empty.container.queryAll(
        (node) => node.type === 'Icon' && node.props.name === 'calendar-outline',
      ),
    ).toHaveLength(1);
  });

  it('opens the modal and confirms a date', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <DatePickerInput value={null} onChange={onChange} placeholder="Birthday" />,
    );

    await pressIcon(screen, 'calendar-outline');
    expect(screen.getByTestId('dp-stub')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('dp-select'));
    expect(onChange).toHaveBeenCalledWith('2024-02-03');
    expect(screen.queryByTestId('dp-stub')).toBeNull();
  });

  it('closes the modal without choosing', async () => {
    const onChange = jest.fn();
    const screen = await render(<DatePickerInput value={null} onChange={onChange} />);

    await pressIcon(screen, 'calendar-outline');
    await fireEvent.press(screen.getByTestId('dp-close'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('dp-stub')).toBeNull();
  });
});

const calendarDefinition = {
  secondsPerMinute: 60,
  minutesPerHour: 60,
  hoursPerDay: 24,
  daysPerWeek: 7,
  weekdayNames: ['Sol', 'Luna', 'Mars', 'Mercury', 'Jove', 'Venus', 'Saturn'],
  unitNames: {},
  months: [
    { name: 'First', days: 30 },
    { name: 'Second', days: 30 },
  ],
  eras: [
    { name: 'Founding', abbreviation: 'F', startYear: 1, direction: 'forward' },
    { name: 'Exile', abbreviation: 'E', startYear: 50, direction: 'forward' },
  ],
  moons: [{ name: 'Eye', periodDays: 29.5, referenceDay: 0 }],
  seasons: [{ name: 'Bloom', startDayOfYear: 1 }],
} as unknown as CalendarDefinitionType;

describe('StoryDateInput', () => {
  beforeEach(() => {
    mockStoryCalendar.mockReturnValue({ definition: calendarDefinition });
  });

  it('explains itself when the story has no calendar', async () => {
    mockStoryCalendar.mockReturnValue({ definition: null });
    const screen = await render(<StoryDateInput value={null} onChange={() => {}} />);
    expect(screen.getByText('story_date_no_calendar')).toBeTruthy();
  });

  it('echoes the entered date with its season, weekday and moons', async () => {
    const screen = await render(<StoryDateInput value={null} onChange={() => {}} />);
    const firstDay = partsToDayNumber(calendarDefinition, { year: 1, month: 1, day: 1 });
    expect(screen.getByText(formatCalendarDate(calendarDefinition, firstDay))).toBeTruthy();
    expect(screen.getByText(/Bloom/)).toBeTruthy();
    expect(screen.getByText(/Eye/)).toBeTruthy();
  });

  it('commits typed years and days and rejects invalid text', async () => {
    const onChange = jest.fn();
    const screen = await render(<StoryDateInput value={null} onChange={onChange} />);
    const [dayField, yearField] = screen.container.queryAll((node) => node.type === 'TextInput');

    await fireEvent.changeText(yearField, '2');
    expect(onChange).toHaveBeenCalledWith(
      String(partsToDayNumber(calendarDefinition, { year: 2, month: 1, day: 1 })),
    );
    await fireEvent.changeText(dayField, '5');
    expect(onChange).toHaveBeenCalledWith(
      String(partsToDayNumber(calendarDefinition, { year: 2, month: 1, day: 5 })),
    );

    onChange.mockClear();
    await fireEvent.changeText(yearField, 'abc');
    await fireEvent.changeText(dayField, '-5');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('changes the month through the picker', async () => {
    const onChange = jest.fn();
    const screen = await render(<StoryDateInput value={null} onChange={onChange} />);

    // The era picker comes first, the month picker second.
    const triggers = screen.getAllByTestId('multiselect-trigger');
    expect(triggers).toHaveLength(2);
    await fireEvent.press(triggers[1]);
    await fireEvent.press(screen.getByText('Second'));
    expect(onChange).toHaveBeenCalledWith(
      String(partsToDayNumber(calendarDefinition, { year: 1, month: 2, day: 1 })),
    );
  });

  it('jumps to the picked era start year', async () => {
    const onChange = jest.fn();
    const screen = await render(<StoryDateInput value={null} onChange={onChange} />);

    await fireEvent.press(screen.getAllByTestId('multiselect-trigger')[0]);
    await fireEvent.press(screen.getByText('Exile (E)'));
    expect(onChange).toHaveBeenCalledWith(
      String(partsToDayNumber(calendarDefinition, { year: 50, month: 1, day: 1 })),
    );
  });

  it('follows the stored value and ignores unreadable ones', async () => {
    const day = String(partsToDayNumber(calendarDefinition, { year: 2, month: 1, day: 1 }));
    const screen = await render(<StoryDateInput value={null} onChange={() => {}} />);
    const yearOf = () => screen.container.queryAll((node) => node.type === 'TextInput')[1];

    await screen.rerender(<StoryDateInput value={day} onChange={() => {}} />);
    expect(yearOf().props.value).toBe('2');
    await screen.rerender(<StoryDateInput value="not-a-day" onChange={() => {}} />);
    expect(yearOf().props.value).toBe('2');
  });

  it('respects the editable flag', async () => {
    const screen = await render(
      <StoryDateInput value={null} onChange={() => {}} editable={false} />,
    );
    for (const field of screen.container.queryAll((node) => node.type === 'TextInput')) {
      expect(field.props.editable).toBe(false);
    }
  });
});

describe('ThemePickerModal', () => {
  const saved = themeDisplayOptions[0];
  const other = themeDisplayOptions.find((option) => option.value !== saved.value)!;

  it('renders nothing while hidden', async () => {
    const screen = await render(
      <ThemePickerModal
        visible={false}
        value={saved.value}
        onPreview={() => {}}
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText('select_theme')).toBeNull();
  });

  it('previews on select and confirms the draft', async () => {
    const onPreview = jest.fn();
    const onConfirm = jest.fn();
    const screen = await render(
      <ThemePickerModal
        visible
        value={saved.value}
        onPreview={onPreview}
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(themeDisplayOptions.length);
    expect(screen.getAllByText('theme_picker_selected')).toHaveLength(1);
    await fireEvent.press(screen.getByText(other.labelKey));
    expect(onPreview).toHaveBeenCalledWith(other.value);
    expect(screen.getAllByText('theme_picker_selected')).toHaveLength(1);
    await fireEvent.press(screen.getByText('save'));
    expect(onConfirm).toHaveBeenCalledWith(other.value);
  });

  it('restores the saved theme on cancel', async () => {
    const onPreview = jest.fn();
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    const screen = await render(
      <ThemePickerModal
        visible
        value={saved.value}
        onPreview={onPreview}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    await fireEvent.press(screen.getByText(other.labelKey));
    await fireEvent.press(screen.getByText('cancel'));
    expect(onPreview).toHaveBeenLastCalledWith(saved.value);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('resets the draft when reopened', async () => {
    const props = {
      value: saved.value,
      onPreview: () => {},
      onConfirm: () => {},
      onClose: () => {},
    };
    const screen = await render(<ThemePickerModal visible {...props} />);
    await fireEvent.press(screen.getByText(other.labelKey));
    expect(screen.getByText('theme_picker_selected')).toBeTruthy();

    await screen.rerender(<ThemePickerModal visible={false} {...props} />);
    await screen.rerender(<ThemePickerModal visible {...props} />);
    const marker = screen.getByText('theme_picker_selected');
    const row = marker.parent;
    const labels = (row?.children ?? [])
      .map((child) => (typeof child === 'string' ? child : child.props.children))
      .flat();
    expect(labels).toContain(saved.labelKey);
  });

  it('disables both actions while saving', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <ThemePickerModal
        visible
        value={saved.value}
        onPreview={() => {}}
        onConfirm={onConfirm}
        onClose={onClose}
        saving
      />,
    );

    await fireEvent.press(screen.getByText('save'));
    await fireEvent.press(screen.getByText('cancel'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
