jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

import { CalendarDefinitionSchema } from '@keres/shared';
import { fireEvent, render } from '@testing-library/react-native';
import SceneFixedDateField, {
  type SceneCalendarOption,
} from '@/src/components/features/scenes/SceneFixedDateField';

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
      onPrimary: '#fff',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const lunar: SceneCalendarOption = {
  id: 'lunar',
  name: 'Lunar',
  isPrimary: true,
  definition: CalendarDefinitionSchema.parse({
    months: Array.from({ length: 13 }, (_, index) => ({ name: `L${index + 1}`, days: 28 })),
  }),
};

const solar: SceneCalendarOption = {
  id: 'solar',
  name: 'Solar',
  isPrimary: false,
  definition: CalendarDefinitionSchema.parse({
    months: Array.from({ length: 10 }, (_, index) => ({ name: `S${index + 1}`, days: 36 })),
  }),
};

const baseProps = () => ({
  value: '',
  onChange: jest.fn(),
  calendarId: null as string | null,
  onCalendarIdChange: jest.fn(),
  calendars: [lunar, solar],
  storyHasEpoch: true,
});

const inputs = (view: Awaited<ReturnType<typeof render>>) =>
  view.container.queryAll((node) => node.type === 'TextInput');

describe('SceneFixedDateField, without a date', () => {
  it('explains what a fixed date is for before offering one', async () => {
    const view = await render(<SceneFixedDateField {...baseProps()} />);

    expect(view.getByText('scene_fixed_date')).toBeTruthy();
    expect(view.getByText('scene_fixed_date_empty_hint')).toBeTruthy();
    expect(inputs(view)).toHaveLength(0);
  });

  it('starts a date in the primary calendar, at the first moment of year one', async () => {
    const props = baseProps();
    const view = await render(<SceneFixedDateField {...props} />);

    await fireEvent.press(view.getByTestId('scene-fixed-date-set'));

    expect(props.onCalendarIdChange).toHaveBeenCalledWith('lunar');
    expect(props.onChange).toHaveBeenCalledWith('0001-01-01T00:00');
  });

  it('starts a Gregorian date when the story has no primary calendar', async () => {
    const props = { ...baseProps(), calendars: [{ ...solar }] };
    const view = await render(<SceneFixedDateField {...props} />);

    await fireEvent.press(view.getByTestId('scene-fixed-date-set'));

    expect(props.onCalendarIdChange).toHaveBeenCalledWith(null);
  });

  it('starts a Gregorian date when the story has no calendar at all', async () => {
    const props = { ...baseProps(), calendars: [] as SceneCalendarOption[] };
    const view = await render(<SceneFixedDateField {...props} />);

    await fireEvent.press(view.getByTestId('scene-fixed-date-set'));

    expect(props.onCalendarIdChange).toHaveBeenCalledWith(null);
    expect(props.onChange).toHaveBeenCalledWith('0001-01-01T00:00');
  });
});

describe('SceneFixedDateField, with a date', () => {
  it('shows the date in its calendar, with the time of day', async () => {
    const view = await render(
      <SceneFixedDateField {...baseProps()} value="0003-02-06T07:08" calendarId="lunar" />,
    );

    expect(view.getByText('6 L2, 3')).toBeTruthy();
    // Day, year, hour and minute.
    expect(inputs(view)).toHaveLength(4);
    expect(inputs(view).map((field) => field.props.value)).toEqual(['6', '3', '7', '8']);
  });

  it('reads a date saved without a calendar as Gregorian', async () => {
    const view = await render(
      <SceneFixedDateField {...baseProps()} value="2023-01-31T10:00" calendarId={null} />,
    );

    expect(view.getByText('2023-01-31')).toBeTruthy();
    expect(view.getByText('January')).toBeTruthy();
  });

  it('writes a change back in the stored notation', async () => {
    const props = { ...baseProps(), value: '0003-02-06T07:08', calendarId: 'lunar' };
    const view = await render(<SceneFixedDateField {...props} />);

    await fireEvent.changeText(inputs(view)[1], '-400');

    expect(props.onChange).toHaveBeenLastCalledWith('-0400-02-06T07:08');
  });

  it('lists Gregorian and the story calendars to write the date in', async () => {
    const props = { ...baseProps(), value: '0003-02-06T07:08', calendarId: 'lunar' };
    const view = await render(<SceneFixedDateField {...props} />);

    await fireEvent.press(view.getAllByTestId('multiselect-trigger')[0]);

    expect(view.getByText('calendar_standard_title')).toBeTruthy();
    // The selected calendar is also the field's value.
    expect(view.getAllByText('Lunar')).toHaveLength(2);
    expect(view.getByText('Solar')).toBeTruthy();
  });

  it('brings the date into the calendar it is moved to, keeping what still exists', async () => {
    const props = { ...baseProps(), value: '0003-13-28T07:08', calendarId: 'lunar' };
    const view = await render(<SceneFixedDateField {...props} />);

    await fireEvent.press(view.getAllByTestId('multiselect-trigger')[0]);
    await fireEvent.press(view.getByText('Solar'));

    // Solar has ten months of 36 days: the 13th month becomes the 10th, and the 28th stays the 28th.
    expect(props.onCalendarIdChange).toHaveBeenCalledWith('solar');
    expect(props.onChange).toHaveBeenCalledWith('0003-10-28T07:08');
  });

  it('moves to Gregorian with null, the way it has always been stored', async () => {
    const props = { ...baseProps(), value: '0003-13-28T07:08', calendarId: 'lunar' };
    const view = await render(<SceneFixedDateField {...props} />);

    await fireEvent.press(view.getAllByTestId('multiselect-trigger')[0]);
    await fireEvent.press(view.getByText('calendar_standard_title'));

    expect(props.onCalendarIdChange).toHaveBeenCalledWith(null);
    expect(props.onChange).toHaveBeenCalledWith('0003-12-28T07:08');
  });

  it('removes the date and the calendar with it', async () => {
    const props = { ...baseProps(), value: '0003-02-06T07:08', calendarId: 'lunar' };
    const view = await render(<SceneFixedDateField {...props} />);

    await fireEvent.press(view.getByTestId('scene-fixed-date-clear'));

    expect(props.onChange).toHaveBeenCalledWith('');
    expect(props.onCalendarIdChange).toHaveBeenCalledWith(null);
  });
});

describe('SceneFixedDateField, when the date cannot place the scene', () => {
  const dated = { value: '0003-02-06T07:08', calendarId: 'lunar' };

  it('says nothing when the story has a primary calendar and a start date', async () => {
    const view = await render(<SceneFixedDateField {...baseProps()} {...dated} />);

    expect(view.queryByText('scene_fixed_date_needs_calendar')).toBeNull();
  });

  it('says so when the story has no start date', async () => {
    const view = await render(
      <SceneFixedDateField {...baseProps()} {...dated} storyHasEpoch={false} />,
    );

    expect(view.getByText('scene_fixed_date_needs_calendar')).toBeTruthy();
  });

  it('says so when the story has no primary calendar', async () => {
    const view = await render(
      <SceneFixedDateField {...baseProps()} {...dated} calendars={[{ ...solar }]} />,
    );

    expect(view.getByText('scene_fixed_date_needs_calendar')).toBeTruthy();
  });
});

describe('SceneFixedDateField, a value that is not a date', () => {
  it('shows it as it is, with a way to remove it, instead of inventing a date', async () => {
    const props = { ...baseProps(), value: 'Day 12' };
    const view = await render(<SceneFixedDateField {...props} />);

    expect(view.getByText('Day 12')).toBeTruthy();
    expect(view.getByText('scene_fixed_date_invalid')).toBeTruthy();
    expect(inputs(view)).toHaveLength(0);

    await fireEvent.press(view.getByTestId('scene-fixed-date-clear'));
    expect(props.onChange).toHaveBeenCalledWith('');
  });
});
