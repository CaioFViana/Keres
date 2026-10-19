import { CalendarDefinitionSchema, type CalendarDateCoordinate } from '@keres/shared';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import CalendarDateFields from '@/src/components/common/inputs/CalendarDateFields/CalendarDateFields';

jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock('@/src/theme', () => ({
  useTheme: () => ({
    isDarkMode: false,
    colors: {
      background: '#fff',
      border: '#ddd',
      primary: '#00f',
      primaryContainer: '#ddf',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
      error: '#f00',
      card: '#fff',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

/** Thirteen months of 28 days, a 20-hour day of 50-minute hours, and two eras. */
const invented = CalendarDefinitionSchema.parse({
  daysPerWeek: 4,
  weekdayNames: ['Ash', 'Bone', 'Clay', 'Dusk'],
  hoursPerDay: 20,
  minutesPerHour: 50,
  months: Array.from({ length: 13 }, (_, index) => ({ name: `Moon ${index + 1}`, days: 28 })),
  eras: [
    { name: 'Old Age', abbreviation: 'O.A.', startYear: -2000, direction: 'forward' },
    { name: 'New Age', abbreviation: 'N.A.', startYear: 1, direction: 'forward' },
  ],
});

const at = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): CalendarDateCoordinate => ({ year, month, day, hour, minute });

const inputs = (view: Awaited<ReturnType<typeof render>>) =>
  view.container.queryAll((node) => node.type === 'TextInput');

describe('CalendarDateFields, a custom calendar', () => {
  it('shows the date in the calendar’s own words, with the week and the era', async () => {
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={() => {}} />,
    );

    expect(view.getByText('6 Moon 2, 3 N.A.')).toBeTruthy();
    expect(view.getByText('Bone')).toBeTruthy();
    expect(view.getByText('New Age (N.A.)')).toBeTruthy();
    expect(view.getByText('Moon 2')).toBeTruthy();
    // Day and year are written out; there is no hour or minute without `withTime`.
    expect(inputs(view)).toHaveLength(2);
  });

  it('commits a typed year, negative ones included, but not the unfinished "-"', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={onChange} />,
    );
    const [, yearField] = inputs(view);

    await fireEvent.changeText(yearField, '-');
    expect(onChange).not.toHaveBeenCalled();
    expect(inputs(view)[1].props.value).toBe('-');

    await fireEvent.changeText(inputs(view)[1], '-400');
    expect(onChange).toHaveBeenLastCalledWith(at(-400, 2, 6));
  });

  it('refuses letters, and a minus in the day', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={onChange} />,
    );
    const [dayField, yearField] = inputs(view);

    await fireEvent.changeText(yearField, 'abc');
    await fireEvent.changeText(dayField, '-5');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not take a day the month does not have: it is the last one', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={onChange} />,
    );

    await fireEvent.changeText(inputs(view)[0], '45');

    expect(onChange).toHaveBeenLastCalledWith(at(3, 2, 28));
  });

  it('waits for a day to be typed rather than committing the "0" of "05"', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={onChange} />,
    );

    await fireEvent.changeText(inputs(view)[0], '0');
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.changeText(inputs(view)[0], '05');
    expect(onChange).toHaveBeenLastCalledWith(at(3, 2, 5));
  });

  it('builds on what was already typed when the parent has not echoed it yet', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={onChange} />,
    );

    await fireEvent.changeText(inputs(view)[1], '9');
    await fireEvent.changeText(inputs(view)[0], '12');

    expect(onChange).toHaveBeenLastCalledWith(at(9, 2, 12));
  });

  it('changes the month by its name', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={onChange} />,
    );
    // The era select comes first, the month select second.
    await fireEvent.press(view.getAllByTestId('multiselect-trigger')[1]);
    await fireEvent.press(view.getByText('Moon 13'));

    expect(onChange).toHaveBeenLastCalledWith(at(3, 13, 6));
  });

  it('titles the month list as the month, not as tags', async () => {
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={() => {}} />,
    );

    await fireEvent.press(view.getAllByTestId('multiselect-trigger')[1]);

    expect(view.getAllByText('calendar_epoch_month').length).toBeGreaterThan(1);
    expect(view.queryByText('select_tags')).toBeNull();
  });

  it('sits the selects on the line of the number fields: no margin of their own', async () => {
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={() => {}} />,
    );

    // The era and the month, whose containers wrap the triggers.
    for (const trigger of view.getAllByTestId('multiselect-trigger')) {
      expect(StyleSheet.flatten(trigger.parent!.props.style).marginBottom).toBe(0);
    }
  });

  it('moves to the first year of the era that was picked', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={onChange} />,
    );

    await fireEvent.press(view.getAllByTestId('multiselect-trigger')[0]);
    await fireEvent.press(view.getByText('Old Age (O.A.)'));

    expect(onChange).toHaveBeenLastCalledWith(at(-2000, 2, 6));
  });

  it('follows a value changed from outside, even over unfinished text', async () => {
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={() => {}} />,
    );
    await fireEvent.changeText(inputs(view)[1], '-');

    await view.rerender(
      <CalendarDateFields calendar={invented} value={at(77, 5, 9)} onChange={() => {}} />,
    );

    expect(inputs(view)[0].props.value).toBe('9');
    expect(inputs(view)[1].props.value).toBe('77');
  });
});

describe('CalendarDateFields, time of day', () => {
  it('asks for the hour and the minute only when told to', async () => {
    const view = await render(
      <CalendarDateFields
        calendar={invented}
        value={at(3, 2, 6, 7, 8)}
        onChange={() => {}}
        withTime
      />,
    );

    expect(inputs(view)).toHaveLength(4);
    expect(view.getByText('calendar_epoch_hour')).toBeTruthy();
    expect(view.getByText('calendar_epoch_minute')).toBeTruthy();
  });

  it('keeps the hour and the minute inside the calendar’s own clock', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={onChange} withTime />,
    );
    const [, , hourField, minuteField] = inputs(view);

    await fireEvent.changeText(hourField, '23');
    expect(onChange).toHaveBeenLastCalledWith(at(3, 2, 6, 19, 0));

    await fireEvent.changeText(minuteField, '59');
    expect(onChange).toHaveBeenLastCalledWith(at(3, 2, 6, 19, 49));
  });

  it('accepts hour 0 and minute 0, unlike a day 0', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields
        calendar={invented}
        value={at(3, 2, 6, 7, 8)}
        onChange={onChange}
        withTime
      />,
    );

    await fireEvent.changeText(inputs(view)[2], '0');

    expect(onChange).toHaveBeenLastCalledWith(at(3, 2, 6, 0, 8));
  });
});

describe('CalendarDateFields, Gregorian', () => {
  it('has the twelve months of the language and no eras', async () => {
    const view = await render(
      <CalendarDateFields calendar={null} value={at(2023, 1, 31)} onChange={() => {}} />,
    );

    expect(view.queryByText('calendar_eras')).toBeNull();
    expect(view.getAllByTestId('multiselect-trigger')).toHaveLength(1);
    expect(view.getByText('January')).toBeTruthy();
    expect(view.getByText('2023-01-31')).toBeTruthy();
    expect(view.getByText('Tue')).toBeTruthy();
  });

  it('shortens the 31st when the month changes to one with fewer days', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields calendar={null} value={at(2023, 1, 31)} onChange={onChange} />,
    );

    await fireEvent.press(view.getByTestId('multiselect-trigger'));
    await fireEvent.press(view.getByText('February'));

    expect(onChange).toHaveBeenLastCalledWith(at(2023, 2, 28));
  });

  it('keeps the 29th of February in a leap year and loses it in the next year', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields calendar={null} value={at(2024, 2, 29)} onChange={onChange} />,
    );

    await fireEvent.changeText(inputs(view)[1], '2025');

    expect(onChange).toHaveBeenLastCalledWith(at(2025, 2, 28));
  });

  it('has a 24-hour day of 60 minutes', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields calendar={null} value={at(2023, 1, 1)} onChange={onChange} withTime />,
    );

    await fireEvent.changeText(inputs(view)[2], '30');
    expect(onChange).toHaveBeenLastCalledWith(at(2023, 1, 1, 23, 0));
  });
});

describe('CalendarDateFields, the calendar grid', () => {
  it('opens on the month of the date and picks the day that is tapped', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={onChange} />,
    );

    await fireEvent.press(view.getByTestId('calendar-date-pick'));
    // The month label of the grid; the select behind it shows the same name, so look for the year.
    expect(view.getByText('Moon 2 · 3')).toBeTruthy();

    // Day 14 of the grid: the 14th day of Moon 2, year 3.
    await fireEvent.press(view.getAllByRole('button', { name: /^14$/ })[0]);

    expect(onChange).toHaveBeenLastCalledWith(at(3, 2, 14));
    await waitFor(() => expect(view.queryByText('Moon 2 · 3')).toBeNull());
  });

  it('browses other months without changing the date until a day is tapped', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 2, 6)} onChange={onChange} />,
    );

    await fireEvent.press(view.getByTestId('calendar-date-pick'));
    await fireEvent.press(view.getByLabelText('next'));

    expect(view.getByText('Moon 3 · 3')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('wraps the year when browsing past the last month', async () => {
    const view = await render(
      <CalendarDateFields calendar={invented} value={at(3, 13, 6)} onChange={() => {}} />,
    );

    await fireEvent.press(view.getByTestId('calendar-date-pick'));
    await fireEvent.press(view.getByLabelText('next'));

    expect(view.getByText('Moon 1 · 4')).toBeTruthy();
  });
});

describe('CalendarDateFields, read only', () => {
  it('locks the fields and offers no calendar', async () => {
    const view = await render(
      <CalendarDateFields
        calendar={invented}
        value={at(3, 2, 6)}
        onChange={() => {}}
        editable={false}
      />,
    );

    for (const field of inputs(view)) expect(field.props.editable).toBe(false);
    expect(view.queryByTestId('calendar-date-pick')).toBeNull();
  });
});

describe('CalendarDateFields, what the preview says of the time', () => {
  afterEach(() => useUserSettingsStore.setState({ use24HourTime: true }));

  it('includes the hour and the minute in the date read back', async () => {
    const view = await render(
      <CalendarDateFields
        calendar={null}
        value={at(2012, 8, 24, 23, 0)}
        onChange={() => {}}
        withTime
      />,
    );

    expect(view.getByText('2012-08-24 · 23:00')).toBeTruthy();
  });

  it('has no time to read when the field has none', async () => {
    const view = await render(
      <CalendarDateFields calendar={null} value={at(2012, 8, 24, 23, 0)} onChange={() => {}} />,
    );

    expect(view.getByText('2012-08-24')).toBeTruthy();
  });

  it('follows the date as it changes', async () => {
    const view = await render(
      <CalendarDateFields
        calendar={invented}
        value={at(3, 2, 6, 7, 8)}
        onChange={() => {}}
        withTime
      />,
    );
    expect(view.getByText('6 Moon 2, 3 N.A. · 07:08')).toBeTruthy();

    await view.rerender(
      <CalendarDateFields
        calendar={invented}
        value={at(3, 2, 6, 19, 49)}
        onChange={() => {}}
        withTime
      />,
    );
    expect(view.getByText('6 Moon 2, 3 N.A. · 19:49')).toBeTruthy();
  });

  describe('on a 12-hour clock', () => {
    beforeEach(() => useUserSettingsStore.setState({ use24HourTime: false }));

    it('reads the time with AM or PM, and shows the clock hour in the field', async () => {
      const view = await render(
        <CalendarDateFields
          calendar={null}
          value={at(2012, 8, 24, 23, 5)}
          onChange={() => {}}
          withTime
        />,
      );

      expect(view.getByText('2012-08-24 · 11:05 attribute_date_pm')).toBeTruthy();
      expect(inputs(view).map((field) => field.props.value)).toEqual(['24', '2012', '11', '5']);
      expect(view.getByTestId('calendar-date-period')).toBeTruthy();
      expect(view.getByText('attribute_date_pm')).toBeTruthy();
    });

    it('shows midnight as 12 AM', async () => {
      const view = await render(
        <CalendarDateFields
          calendar={null}
          value={at(2012, 8, 24, 0, 0)}
          onChange={() => {}}
          withTime
        />,
      );

      expect(inputs(view)[2].props.value).toBe('12');
      expect(view.getByText('attribute_date_am')).toBeTruthy();
      expect(view.getByText('2012-08-24 · 12:00 attribute_date_am')).toBeTruthy();
    });

    it('stores the hour typed in the period it is in: 3 in the evening is 15', async () => {
      const onChange = jest.fn();
      const view = await render(
        <CalendarDateFields
          calendar={null}
          value={at(2012, 8, 24, 23, 0)}
          onChange={onChange}
          withTime
        />,
      );

      await fireEvent.changeText(inputs(view)[2], '3');

      expect(onChange).toHaveBeenLastCalledWith(at(2012, 8, 24, 15, 0));
    });

    it('turns 12 AM into hour 0', async () => {
      const onChange = jest.fn();
      const view = await render(
        <CalendarDateFields
          calendar={null}
          value={at(2012, 8, 24, 5, 0)}
          onChange={onChange}
          withTime
        />,
      );

      await fireEvent.changeText(inputs(view)[2], '12');

      expect(onChange).toHaveBeenLastCalledWith(at(2012, 8, 24, 0, 0));
    });

    it('turns 12 PM into hour 12', async () => {
      const onChange = jest.fn();
      const view = await render(
        <CalendarDateFields
          calendar={null}
          value={at(2012, 8, 24, 17, 0)}
          onChange={onChange}
          withTime
        />,
      );

      await fireEvent.changeText(inputs(view)[2], '12');

      expect(onChange).toHaveBeenLastCalledWith(at(2012, 8, 24, 12, 0));
    });

    it('has no hour 0, and holds 13 to 12', async () => {
      const onChange = jest.fn();
      const view = await render(
        <CalendarDateFields
          calendar={null}
          value={at(2012, 8, 24, 5, 0)}
          onChange={onChange}
          withTime
        />,
      );

      await fireEvent.changeText(inputs(view)[2], '0');
      expect(onChange).not.toHaveBeenCalled();

      await fireEvent.changeText(inputs(view)[2], '15');
      expect(onChange).toHaveBeenLastCalledWith(at(2012, 8, 24, 0, 0));
    });

    it('moves the hour half a day when the period is toggled, and back', async () => {
      const onChange = jest.fn();
      const view = await render(
        <CalendarDateFields
          calendar={null}
          value={at(2012, 8, 24, 23, 5)}
          onChange={onChange}
          withTime
        />,
      );

      await fireEvent.press(view.getByTestId('calendar-date-period'));
      expect(onChange).toHaveBeenLastCalledWith(at(2012, 8, 24, 11, 5));

      await view.rerender(
        <CalendarDateFields
          calendar={null}
          value={at(2012, 8, 24, 11, 5)}
          onChange={onChange}
          withTime
        />,
      );
      expect(view.getByText('attribute_date_am')).toBeTruthy();
      await fireEvent.press(view.getByTestId('calendar-date-period'));
      expect(onChange).toHaveBeenLastCalledWith(at(2012, 8, 24, 23, 5));
    });

    it('keeps the clock hour on screen when the value changes from outside', async () => {
      const view = await render(
        <CalendarDateFields
          calendar={null}
          value={at(2012, 8, 24, 23, 5)}
          onChange={() => {}}
          withTime
        />,
      );

      await view.rerender(
        <CalendarDateFields
          calendar={null}
          value={at(2012, 8, 24, 15, 5)}
          onChange={() => {}}
          withTime
        />,
      );

      expect(inputs(view)[2].props.value).toBe('3');
    });

    it('has no period on a calendar whose day is not 24 hours long', async () => {
      const view = await render(
        <CalendarDateFields
          calendar={invented}
          value={at(3, 2, 6, 17, 8)}
          onChange={() => {}}
          withTime
        />,
      );

      expect(view.queryByTestId('calendar-date-period')).toBeNull();
      expect(inputs(view)[2].props.value).toBe('17');
      expect(view.getByText('6 Moon 2, 3 N.A. · 17:08')).toBeTruthy();
    });

    it('has no period without a time of day', async () => {
      const view = await render(
        <CalendarDateFields calendar={null} value={at(2012, 8, 24, 23, 5)} onChange={() => {}} />,
      );

      expect(view.queryByTestId('calendar-date-period')).toBeNull();
    });

    it('locks the period when read only', async () => {
      const onChange = jest.fn();
      const view = await render(
        <CalendarDateFields
          calendar={null}
          value={at(2012, 8, 24, 23, 5)}
          onChange={onChange}
          withTime
          editable={false}
        />,
      );

      await fireEvent.press(view.getByTestId('calendar-date-period'));

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
