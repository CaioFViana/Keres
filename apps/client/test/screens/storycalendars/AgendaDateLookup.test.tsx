/** @jest-environment node */
const mockButtonProps = jest.fn();
const mockTextInputProps = jest.fn();
const mockPillProps = jest.fn();
const mockDatePickerProps = jest.fn();
const mockUseUserSettingsStore = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/src/theme', () => ({
  useTheme: () => ({ colors: { onPrimary: '#fff' } }),
}));
jest.mock('@/src/state/userSettingsStore', () => ({
  useUserSettingsStore: (...args: unknown[]) => mockUseUserSettingsStore(...args),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/src/components/common/controls/Button/Button', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockButtonProps(props);
    return null;
  },
}));
jest.mock('@/src/components/common/inputs/TextInput/TextInput', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockTextInputProps(props);
    return null;
  },
}));
jest.mock('@/src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => ({
  SingleSelectPill: (props: unknown) => {
    mockPillProps(props);
    return null;
  },
}));
jest.mock('@/src/components/common/inputs/DatePickerInput/DatePickerInput', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockDatePickerProps(props);
    return null;
  },
}));

import React from 'react';
import { act, render } from '@testing-library/react-native';
import type { CalendarDefinitionType } from '@keres/shared';
import {
  formatAttributeDate,
  formatGregorianDate,
  gregorianDayNumber,
  gregorianPartsFromDayNumber,
  partsToDayNumber,
} from '@keres/shared';
import {
  CustomCalendarDateLookup,
  GregorianCalendarDateLookup,
} from '../../../src/screens/storycalendars/AgendaDateLookup';

const styles = {
  lookup: {},
  lookupTitle: {},
  lookupRow: {},
  lookupField: {},
  lookupLabel: {},
  lookupInput: {},
  lookupYear: {},
  lookupMonth: {},
  lookupGo: {},
} as never;

const definition: CalendarDefinitionType = {
  secondsPerMinute: 60,
  minutesPerHour: 60,
  hoursPerDay: 24,
  daysPerWeek: 7,
  weekdayNames: [],
  unitNames: {},
  months: [
    { name: 'Aurora', days: 30 },
    { name: '', days: 30 },
  ],
  eras: [{ name: 'After Fall', abbreviation: 'AF', startYear: 1, direction: 'forward' }],
  moons: [],
  seasons: [],
};

const lastProps = (spy: jest.Mock) => spy.mock.calls[spy.mock.calls.length - 1][0];
const pillCalls = () => mockPillProps.mock.calls.map((call) => call[0]);
// Pills re-render on every keystroke, so always read the latest props of each instance.
const lastPill = (optionsLength: number) =>
  [...pillCalls()].reverse().find((props) => props.options?.length === optionsLength);
const monthPill = () => lastPill(2);
const eraPill = () => lastPill(1);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseUserSettingsStore.mockImplementation((selector: (state: unknown) => unknown) =>
    selector({ dateDisplayFormat: 'iso' }),
  );
});

describe('CustomCalendarDateLookup', () => {
  it('lists months by name with a numeric fallback and jumps to the chosen month', async () => {
    const onMonthChange = jest.fn();
    await render(
      <CustomCalendarDateLookup
        definition={definition}
        cursor={0}
        onMonthChange={onMonthChange}
        styles={styles}
      />,
    );

    expect(monthPill().options).toEqual([
      { label: 'Aurora', value: '1' },
      { label: '2', value: '2' },
    ]);

    await act(async () => {
      lastProps(mockTextInputProps).onChangeText('2');
    });
    await act(async () => {
      monthPill().onValueChange('2');
    });
    await act(async () => {
      lastProps(mockButtonProps).onPress();
    });

    expect(onMonthChange).toHaveBeenCalledWith(
      partsToDayNumber(definition, { year: 2, month: 2, day: 1 }),
    );
    expect(lastProps(mockButtonProps).accessibilityLabel).toBe('agenda_go_to_date');
  });

  it('accepts only numeric year text and ignores a cleared month', async () => {
    await render(
      <CustomCalendarDateLookup
        definition={definition}
        cursor={0}
        onMonthChange={jest.fn()}
        styles={styles}
      />,
    );

    await act(async () => {
      lastProps(mockTextInputProps).onChangeText('20x');
    });
    expect(lastProps(mockTextInputProps).value).toBe('1');

    await act(async () => {
      lastProps(mockTextInputProps).onChangeText('-5');
    });
    expect(lastProps(mockTextInputProps).value).toBe('-5');

    await act(async () => {
      monthPill().onValueChange(null);
    });
    expect(monthPill().value).toBe('1');
  });

  it('offers eras with their year ranges and jumps the year to the picked era', async () => {
    await render(
      <CustomCalendarDateLookup
        definition={definition}
        cursor={0}
        onMonthChange={jest.fn()}
        styles={styles}
      />,
    );

    expect(eraPill().options).toEqual([{ label: 'After Fall (AF) · 1–∞', value: '0' }]);

    await act(async () => {
      eraPill().onValueChange('0');
    });
    expect(lastProps(mockTextInputProps).value).toBe('1');

    await act(async () => {
      eraPill().onValueChange(null);
    });
    expect(eraPill().value).toBeNull();
  });

  it('reads a backward era as the year before its start', async () => {
    const backward: CalendarDefinitionType = {
      ...definition,
      eras: [{ name: 'Before', abbreviation: 'B', startYear: 1, direction: 'backward' }],
    };
    await render(
      <CustomCalendarDateLookup
        definition={backward}
        cursor={0}
        onMonthChange={jest.fn()}
        styles={styles}
      />,
    );

    expect(eraPill().options).toEqual([{ label: 'Before (B) · ≤ 0', value: '0' }]);

    await act(async () => {
      eraPill().onValueChange('0');
    });
    expect(lastProps(mockTextInputProps).value).toBe('0');
  });

  it('hides the era picker when the calendar has no eras', async () => {
    const noEras: CalendarDefinitionType = { ...definition, eras: [] };
    await render(
      <CustomCalendarDateLookup
        definition={noEras}
        cursor={0}
        onMonthChange={jest.fn()}
        styles={styles}
      />,
    );

    expect(pillCalls()).toHaveLength(1);
    expect(monthPill().options).toHaveLength(2);
  });

  it('resyncs the fields when the agenda cursor moves', async () => {
    const screen = await render(
      <CustomCalendarDateLookup
        definition={definition}
        cursor={0}
        onMonthChange={jest.fn()}
        styles={styles}
      />,
    );
    expect(lastProps(mockTextInputProps).value).toBe('1');

    const moved = partsToDayNumber(definition, { year: 3, month: 2, day: 15 });
    await act(async () => {
      screen.rerender(
        <CustomCalendarDateLookup
          definition={definition}
          cursor={moved}
          onMonthChange={jest.fn()}
          styles={styles}
        />,
      );
    });

    expect(lastProps(mockTextInputProps).value).toBe('3');
    expect(monthPill().value).toBe('2');
  });
});

describe('GregorianCalendarDateLookup', () => {
  it('drives the agenda through the established date picker', async () => {
    const onMonthChange = jest.fn();
    const cursor = gregorianDayNumber({ year: 2026, month: 4, day: 9 });
    const screen = await render(
      <GregorianCalendarDateLookup cursor={cursor} onMonthChange={onMonthChange} styles={styles} />,
    );

    expect(await screen.findByText('agenda_go_to_date')).toBeTruthy();
    const parts = gregorianPartsFromDayNumber(cursor);
    expect(lastProps(mockDatePickerProps).value).toBe(
      formatAttributeDate({ ...parts, hour: null, minute: null }),
    );

    await act(async () => {
      lastProps(mockDatePickerProps).onChange('2025-12-25');
    });
    expect(onMonthChange).toHaveBeenCalledWith(
      gregorianDayNumber({ year: 2025, month: 12, day: 25 }),
    );
  });

  it('ignores picker values that are not valid dates', async () => {
    const onMonthChange = jest.fn();
    const cursor = gregorianDayNumber({ year: 2026, month: 4, day: 9 });
    await render(
      <GregorianCalendarDateLookup cursor={cursor} onMonthChange={onMonthChange} styles={styles} />,
    );

    await act(async () => {
      lastProps(mockDatePickerProps).onChange('not-a-date');
    });

    expect(onMonthChange).not.toHaveBeenCalled();
  });

  it('renders far-future dates as text instead of a picker that cannot type them', async () => {
    const onMonthChange = jest.fn();
    const cursor = gregorianDayNumber({ year: 12000, month: 1, day: 1 });
    const screen = await render(
      <GregorianCalendarDateLookup cursor={cursor} onMonthChange={onMonthChange} styles={styles} />,
    );

    expect(mockDatePickerProps).not.toHaveBeenCalled();
    const parts = gregorianPartsFromDayNumber(cursor);
    expect(await screen.findByText(formatGregorianDate(parts, 'iso'))).toBeTruthy();
  });

  it('honours the user date format for out-of-range dates', async () => {
    mockUseUserSettingsStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({ dateDisplayFormat: 'dmy' }),
    );
    const cursor = gregorianDayNumber({ year: 12000, month: 3, day: 4 });
    const screen = await render(
      <GregorianCalendarDateLookup cursor={cursor} onMonthChange={jest.fn()} styles={styles} />,
    );

    const parts = gregorianPartsFromDayNumber(cursor);
    expect(await screen.findByText(formatGregorianDate(parts, 'dmy'))).toBeTruthy();
  });
});
