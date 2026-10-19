import { fireEvent, render } from '@testing-library/react-native';
import { CalendarDefinitionSchema, gregorianDayNumber } from '@keres/shared';
import CalendarMonthGrid from '@/src/components/features/calendars/CalendarMonthGrid/CalendarMonthGrid';

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
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

/** Three 10-day months and a 5-day week, so a month is exactly two rows. */
const tiny = CalendarDefinitionSchema.parse({
  daysPerWeek: 5,
  weekdayNames: ['A', 'B', 'C', 'D', 'E'],
  months: [
    { name: 'First', days: 10 },
    { name: 'Second', days: 10 },
    { name: '', days: 10 },
  ],
});

const baseProps = () => ({
  calendar: tiny,
  year: 1,
  month: 2,
  selectedDay: null as number | null,
  onSelectDay: jest.fn(),
  onShiftMonth: jest.fn(),
});

describe('CalendarMonthGrid, a custom calendar', () => {
  it('titles the month by name and year, and names the weekdays of the calendar', async () => {
    const view = await render(<CalendarMonthGrid {...baseProps()} />);

    expect(view.getByText('Second · 1')).toBeTruthy();
    for (const label of ['A', 'B', 'C', 'D', 'E']) expect(view.getByText(label)).toBeTruthy();
  });

  it('numbers an unnamed month', async () => {
    const view = await render(<CalendarMonthGrid {...baseProps()} month={3} />);

    expect(view.getByText('3 · 1')).toBeTruthy();
  });

  it('draws the days of the month, and the neighbours’ in dimmed cells', async () => {
    const view = await render(<CalendarMonthGrid {...baseProps()} />);

    // Month 2 runs from day number 10 to 19: two rows of five, no neighbours needed.
    expect(
      view.getAllByRole('button').filter((node) => node.props.accessibilityState),
    ).toHaveLength(10);
  });

  it('reports the day that was tapped as its number', async () => {
    const props = baseProps();
    const view = await render(<CalendarMonthGrid {...props} describeDay={(day) => `day ${day}`} />);

    await fireEvent.press(view.getByLabelText('day 13'));

    expect(props.onSelectDay).toHaveBeenCalledWith(13);
  });

  it('marks the selected day', async () => {
    const view = await render(
      <CalendarMonthGrid {...baseProps()} selectedDay={12} describeDay={(day) => `day ${day}`} />,
    );

    expect(view.getByLabelText('day 12').props.accessibilityState).toEqual({ selected: true });
    expect(view.getByLabelText('day 13').props.accessibilityState).toEqual({ selected: false });
  });

  it('asks to move a month in either direction', async () => {
    const props = baseProps();
    const view = await render(<CalendarMonthGrid {...props} />);

    await fireEvent.press(view.getByLabelText('next'));
    await fireEvent.press(view.getByLabelText('previous'));

    expect(props.onShiftMonth).toHaveBeenNthCalledWith(1, 1);
    expect(props.onShiftMonth).toHaveBeenNthCalledWith(2, -1);
  });

  it('names what happens on a day in its cell and its spoken label', async () => {
    const view = await render(
      <CalendarMonthGrid
        {...baseProps()}
        describeDay={(day) => `day ${day}`}
        entriesByDay={
          new Map([
            [
              11,
              [
                { id: 's', name: 'Opening', kind: 'scene' as const },
                { id: 'e', name: 'Festival', kind: 'event' as const },
              ],
            ],
          ])
        }
      />,
    );

    expect(view.getByText('Opening')).toBeTruthy();
    expect(view.getByText('◆ Festival')).toBeTruthy();
    expect(view.getByLabelText('day 11: Opening, Festival')).toBeTruthy();
  });

  it('leaves the entries out in a compact grid, which only picks days', async () => {
    const view = await render(
      <CalendarMonthGrid
        {...baseProps()}
        compact
        entriesByDay={new Map([[11, [{ id: 's', name: 'Opening', kind: 'scene' as const }]]])}
      />,
    );

    expect(view.queryByText('Opening')).toBeNull();
  });
});

describe('CalendarMonthGrid, a calendar without weekday names', () => {
  it('draws the days with no weekday header', async () => {
    const unnamed = CalendarDefinitionSchema.parse({
      daysPerWeek: 4,
      months: [{ name: 'Only', days: 8 }],
    });
    const view = await render(<CalendarMonthGrid {...baseProps()} calendar={unnamed} month={1} />);

    expect(view.getByText('Only · 1')).toBeTruthy();
    expect(view.queryByText('A')).toBeNull();
  });
});

describe('CalendarMonthGrid, Gregorian', () => {
  it('lays January 2023 out from Sunday, under Sunday-first labels', async () => {
    const props = { ...baseProps(), calendar: null, year: 2023, month: 1 };
    const view = await render(<CalendarMonthGrid {...props} describeDay={(day) => `day ${day}`} />);

    const sunday = gregorianDayNumber({ year: 2023, month: 1, day: 1 });
    // The first cell of the first row is the 1st: Sunday, so no padding before it.
    const cells = view.getAllByRole('button').filter((node) => node.props.accessibilityState);
    expect(cells[0].props.accessibilityLabel).toBe(`day ${sunday}`);
    expect(cells).toHaveLength(35);
  });

  it('pads the first week of a month that does not start on Sunday', async () => {
    // 2024-02-01 was a Thursday: four cells of January come first.
    const props = { ...baseProps(), calendar: null, year: 2024, month: 2 };
    const view = await render(<CalendarMonthGrid {...props} describeDay={(day) => `day ${day}`} />);

    const first = gregorianDayNumber({ year: 2024, month: 2, day: 1 });
    const cells = view.getAllByRole('button').filter((node) => node.props.accessibilityState);
    expect(cells[4].props.accessibilityLabel).toBe(`day ${first}`);
    expect(cells[0].props.accessibilityLabel).toBe(`day ${first - 4}`);
  });
});
