import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { CalendarDefinitionType } from '@keres/shared';
import { partsToDayNumber } from '@keres/shared';

const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate };
const mockRoute: { params: { calendarId?: string } } = { params: {} };
const mockNavigateToDetail = jest.fn();
const mockHeaderConfig: { current: { title: string } | null } = { current: null };
const mockSelectedStory: { current: { id: string; timelineEpochDay: number | null } } = {
  current: { id: 'story-1', timelineEpochDay: null },
};
const mockI18n = { t: (key: string) => key, i18n: { language: 'en' } };
let mockLookupProps: { cursor: number; onMonthChange: (day: number) => void } | null = null;

const definition: CalendarDefinitionType = {
  secondsPerMinute: 60,
  minutesPerHour: 60,
  hoursPerDay: 24,
  daysPerWeek: 7,
  weekdayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  unitNames: {},
  months: [
    { name: 'Aurora', days: 30 },
    { name: 'Bloom', days: 30 },
  ],
  eras: [],
  moons: [],
  seasons: [],
};

const otherDefinition: CalendarDefinitionType = {
  ...definition,
  weekdayNames: [],
  months: [{ name: 'Primus', days: 20 }],
};

const sceneDay = partsToDayNumber(definition, { year: 1, month: 1, day: 5 });
const eventDay = partsToDayNumber(definition, { year: 1, month: 1, day: 10 });
const mockLaterSceneDay = partsToDayNumber(definition, { year: 1, month: 2, day: 3 });

const mockCalendarState: {
  current: {
    calendars: { id: string; definition: CalendarDefinitionType }[];
    definition: CalendarDefinitionType | null;
  };
} = { current: { calendars: [], definition } };
const mockAgendaState: {
  current: {
    entries: {
      id: string;
      dayNumber: number;
      kind: string;
      name: string;
      summary: string | null;
    }[];
    loading: boolean;
  };
} = { current: { entries: [], loading: false } };

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => mockNavigation,
    useRoute: () => mockRoute,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('@/src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => {
    mockHeaderConfig.current = config as never;
  },
}));
jest.mock('../../../src/screens/storycalendars/AgendaDateLookup', () => {
  const { Text } = require('react-native');
  const stub =
    (marker: string) => (props: { cursor: number; onMonthChange: (day: number) => void }) => {
      mockLookupProps = props;
      return (
        <>
          <Text testID="lookup-marker">{marker}</Text>
          <Text testID="lookup-jump" onPress={() => props.onMonthChange(mockLaterSceneDay)}>
            jump
          </Text>
        </>
      );
    };
  return {
    __esModule: true,
    CustomCalendarDateLookup: stub('custom-lookup'),
    GregorianCalendarDateLookup: stub('gregorian-lookup'),
  };
});
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useStoryAgenda', () => ({
  __esModule: true,
  useStoryAgenda: () => mockAgendaState.current,
}));
jest.mock('../../../src/hooks/useStoryCalendar', () => ({
  __esModule: true,
  useStoryCalendar: () => mockCalendarState.current,
}));
jest.mock('../../../src/hooks/useNavigateToEntityDetail', () => ({
  __esModule: true,
  useNavigateToEntityDetail: () => mockNavigateToDetail,
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: unknown) => unknown) =>
    selector({ selectedStory: mockSelectedStory.current }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({ dateDisplayFormat: 'iso' }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#ccf',
      secondary: '#888',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => mockI18n,
}));

import StoryAgendaScreen from '../../../src/screens/storycalendars/StoryAgendaScreen';

const sceneEntries = () => [
  { id: 'scene-1', dayNumber: sceneDay, kind: 'scene', name: 'Opening', summary: 'It begins' },
  { id: 'event-1', dayNumber: eventDay, kind: 'event', name: 'Festival', summary: null },
  { id: 'scene-2', dayNumber: mockLaterSceneDay, kind: 'scene', name: 'Departure', summary: null },
];

describe('StoryAgendaScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLookupProps = null;
    mockHeaderConfig.current = null;
    mockRoute.params = {};
    mockSelectedStory.current = { id: 'story-1', timelineEpochDay: null };
    mockCalendarState.current = { calendars: [], definition };
    mockAgendaState.current = { entries: [], loading: false };
  });

  it('shows the loading state from the agenda hook', async () => {
    mockAgendaState.current = { entries: [], loading: true };
    const view = await render(<StoryAgendaScreen />);

    expect(view.getByText('loading')).toBeTruthy();
    expect(mockHeaderConfig.current?.title).toBe('agenda_title');
  });

  it('opens on the first placed entry and shows its day details', async () => {
    mockAgendaState.current = { entries: sceneEntries(), loading: false };
    const view = await render(<StoryAgendaScreen />);

    await waitFor(() => expect(view.getByTestId('lookup-marker')).toBeTruthy());
    expect(view.getByTestId('lookup-marker').props.children).toBe('custom-lookup');
    expect(view.getByText('Aurora · 1')).toBeTruthy();
    expect(view.getByText('Sun')).toBeTruthy();
    expect(view.getAllByText('Opening').length).toBeGreaterThan(0);
    expect(view.getByText('It begins')).toBeTruthy();
    expect(view.getByText('◆ Festival')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('Opening'));
    expect(mockNavigateToDetail).toHaveBeenCalledWith('Scene', 'scene-1');
  });

  it('jumps between scenes and events by content', async () => {
    mockAgendaState.current = { entries: sceneEntries(), loading: false };
    const view = await render(<StoryAgendaScreen />);
    await waitFor(() => expect(view.getByText('Aurora · 1')).toBeTruthy());

    await fireEvent.press(view.getAllByText('agenda_next_event')[0]);
    await waitFor(() => expect(view.queryByText('It begins')).toBeNull());

    await fireEvent.press(view.getByText('agenda_next_scene'));
    await waitFor(() => expect(view.getByText('Bloom · 1')).toBeTruthy());

    await fireEvent.press(view.getByText('agenda_previous_scene'));
    await waitFor(() => expect(view.getByText('Aurora · 1')).toBeTruthy());
  });

  it('pages months and drives the cursor from the date lookup', async () => {
    mockAgendaState.current = { entries: sceneEntries(), loading: false };
    const view = await render(<StoryAgendaScreen />);
    await waitFor(() => expect(view.getByText('Aurora · 1')).toBeTruthy());

    await fireEvent.press(view.getByLabelText('next'));
    await waitFor(() => expect(view.getByText('Bloom · 1')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('previous'));
    await waitFor(() => expect(view.getByText('Aurora · 1')).toBeTruthy());

    await fireEvent.press(view.getByTestId('lookup-jump'));
    await waitFor(() => expect(view.getByText('Bloom · 1')).toBeTruthy());
    expect(mockLookupProps?.cursor).toBe(mockLaterSceneDay);
  });

  it('links to the calendar list while the story has no epoch', async () => {
    mockAgendaState.current = { entries: [], loading: false };
    const view = await render(<StoryAgendaScreen />);

    await waitFor(() => expect(view.getByText('agenda_no_epoch')).toBeTruthy());
    await fireEvent.press(view.getByText('agenda_no_epoch'));
    expect(mockNavigate).toHaveBeenCalledWith('StoryCalendarList');

    mockSelectedStory.current = { id: 'story-1', timelineEpochDay: sceneDay };
    const anchored = await render(<StoryAgendaScreen />);
    await waitFor(() => expect(anchored.getByTestId('lookup-marker')).toBeTruthy());
    expect(anchored.queryByText('agenda_no_epoch')).toBeNull();
  });

  it('browses a requested calendar and falls back to gregorian', async () => {
    mockCalendarState.current = {
      calendars: [
        { id: 'cal-1', definition },
        { id: 'cal-2', definition: otherDefinition },
      ],
      definition,
    };
    mockRoute.params = { calendarId: 'cal-2' };
    const view = await render(<StoryAgendaScreen />);

    await waitFor(() => expect(view.getByText('Primus · 1')).toBeTruthy());
    expect(view.queryByText('Sun')).toBeNull();

    mockRoute.params = { calendarId: 'cal-unknown' };
    const gregorian = await render(<StoryAgendaScreen />);
    await waitFor(() =>
      expect(gregorian.getByTestId('lookup-marker').props.children).toBe('gregorian-lookup'),
    );
  });

  it('renders event entries as badges without navigation', async () => {
    mockAgendaState.current = { entries: sceneEntries(), loading: false };
    const view = await render(<StoryAgendaScreen />);
    await waitFor(() => expect(view.getByText('Aurora · 1')).toBeTruthy());

    await fireEvent.press(view.getByText('agenda_next_event'));
    await waitFor(() => expect(view.queryByText('It begins')).toBeNull());
    expect(view.getAllByText('agenda_next_event').length).toBeGreaterThan(1);
    expect(mockNavigateToDetail).not.toHaveBeenCalled();
  });
});
