import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { CalendarDefinitionType } from '@keres/shared';
import { gregorianDayNumber, partsToDayNumber } from '@keres/shared';
import React from 'react';

const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate };
const mockSetPrimary = jest.fn();
const mockClearPrimary = jest.fn();
const mockDeleteCalendar = jest.fn();
const mockReload = jest.fn();
const mockUpdateStory = jest.fn();
const mockGetStoryById = jest.fn();
const mockSetSelectedStory = jest.fn();
const mockNotify = jest.fn();
const mockAlert = jest.fn();
const mockStory: {
  current: { id: string; timelineEpochDay: number | null; timelineEpochSeconds: number | null };
} = {
  current: { id: 'story-1', timelineEpochDay: null, timelineEpochSeconds: null },
};
const mockCalendarState: {
  current: {
    calendars: {
      id: string;
      name: string;
      description: string | null;
      definition: CalendarDefinitionType;
    }[];
    primary: {
      id: string;
      name: string;
      description: string | null;
      definition: CalendarDefinitionType;
    } | null;
    reload: () => void;
  };
} = { current: { calendars: [], primary: null, reload: mockReload } };
const mockCanEdit: { current: boolean } = { current: true };
const mockHeaderConfig: {
  current: { actions: { onPress: () => void; visible?: boolean }[] } | null;
} = {
  current: null,
};
const mockDb = {};
const mockI18n = { t: (key: string) => key };

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

const cal1 = { id: 'cal-1', name: 'Reckoning', description: 'Main calendar', definition };
const cal2 = { id: 'cal-2', name: 'Lunar', description: null, definition };

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => mockNavigation,
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
jest.mock('@/src/components/features/calendars/CalendarAnchorsModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      visible,
      calendarName,
      onClose,
    }: {
      visible: boolean;
      calendarName: string;
      onClose: () => void;
    }) => {
      if (!visible) return null;
      return (
        <>
          <Text testID="anchors-modal">{calendarName}</Text>
          <Text testID="anchors-close" onPress={onClose}>
            close
          </Text>
        </>
      );
    },
  };
});
jest.mock('@/src/components/common/inputs/DatePickerInput/DatePickerInput', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ value, onChange }: { value: string | null; onChange: (v: string) => void }) => (
      <>
        <Text testID="date-picker">{value ?? 'no-date'}</Text>
        <Text testID="date-change" onPress={() => onChange('2026-04-09')}>
          change
        </Text>
      </>
    ),
  };
});
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useStoryCalendar', () => ({
  __esModule: true,
  useStoryCalendar: () => mockCalendarState.current,
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit.current }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1', dateDisplayFormat: 'iso' }),
}));
jest.mock('../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: (selector: (state: unknown) => unknown) =>
    selector({ showNotification: mockNotify }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: unknown) => unknown) =>
    selector({ selectedStory: mockStory.current, setSelectedStory: mockSetSelectedStory }),
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
      onPrimaryContainer: '#003',
      primary: '#00f',
      primaryContainer: '#ccf',
      secondary: '#888',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../../src/services/storymanagement/StoryCalendarService', () => ({
  __esModule: true,
  createStoryCalendarService: () => ({
    setPrimary: mockSetPrimary,
    clearPrimary: mockClearPrimary,
    deleteCalendar: mockDeleteCalendar,
  }),
}));
jest.mock('../../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: () => ({
    updateStory: mockUpdateStory,
    getStoryById: mockGetStoryById,
  }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => mockI18n,
}));

import StoryCalendarListScreen from '../../../src/screens/storycalendars/StoryCalendarListScreen';
import { withSilencedConsole } from '../../helpers/silenceConsole';

const epochDay = partsToDayNumber(definition, { year: 2, month: 1, day: 1 });

function confirmAlert(buttonText: string) {
  const buttons = mockAlert.mock.calls[mockAlert.mock.calls.length - 1][2] as {
    text: string;
    onPress?: () => void;
  }[];
  const confirm = buttons.find((button) => button.text === buttonText);
  return act(async () => {
    await confirm?.onPress?.();
  });
}

describe('StoryCalendarListScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockHeaderConfig.current = null;
    mockCanEdit.current = true;
    mockStory.current = { id: 'story-1', timelineEpochDay: null, timelineEpochSeconds: null };
    mockCalendarState.current = { calendars: [cal1, cal2], primary: cal1, reload: mockReload };
    mockSetPrimary.mockResolvedValue({});
    mockClearPrimary.mockResolvedValue({});
    mockDeleteCalendar.mockResolvedValue({});
    mockUpdateStory.mockResolvedValue({});
    mockGetStoryById.mockResolvedValue({ id: 'story-1', timelineEpochDay: null });
    mockReload.mockResolvedValue({});
  });

  it('renders calendars with the primary badge and epoch fields', async () => {
    mockStory.current = { id: 'story-1', timelineEpochDay: epochDay, timelineEpochSeconds: 3600 };
    const view = await render(<StoryCalendarListScreen />);

    expect(view.getByText('calendar_list_intro')).toBeTruthy();
    expect(view.getByText('Reckoning')).toBeTruthy();
    expect(view.getByText('Lunar')).toBeTruthy();
    expect(view.getByText('Main calendar')).toBeTruthy();
    expect(view.getAllByText('calendar_primary')).toHaveLength(1);
    await waitFor(() => expect(mockReload).toHaveBeenCalled());

    await waitFor(() => expect(view.getByDisplayValue('2')).toBeTruthy());
    expect(view.getByText('calendar_epoch_title')).toBeTruthy();
  });

  it('shows the standard calendar and gregorian epoch without a primary', async () => {
    mockCalendarState.current = { calendars: [], primary: null, reload: mockReload };
    const view = await render(<StoryCalendarListScreen />);

    expect(view.getByText('calendar_list_empty')).toBeTruthy();
    expect(view.getByText('calendar_standard_title')).toBeTruthy();
    expect(view.getByTestId('date-picker')).toBeTruthy();
    expect(view.getByText('calendar_standard_epoch_hint')).toBeTruthy();

    await fireEvent.press(view.getAllByText('calendar_view_agenda')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('StoryAgenda');
  });

  it('opens the form and agenda from card actions', async () => {
    const view = await render(<StoryCalendarListScreen />);

    await act(async () => {
      mockHeaderConfig.current?.actions[0].onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('StoryCalendarForm', {});

    await fireEvent.press(view.getAllByText('edit')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('StoryCalendarForm', { calendarId: 'cal-1' });

    await fireEvent.press(view.getAllByText('calendar_view_agenda')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('StoryAgenda', { calendarId: 'cal-1' });
  });

  it('promotes a calendar directly when the story has no epoch', async () => {
    const view = await render(<StoryCalendarListScreen />);

    await fireEvent.press(view.getByText('calendar_make_primary'));
    await waitFor(() => expect(mockSetPrimary).toHaveBeenCalledWith('user-1', 'cal-2'));
    expect(mockAlert).not.toHaveBeenCalled();
    await waitFor(() => expect(mockReload).toHaveBeenCalled());
  });

  it('clears the epoch before promoting when one is set', async () => {
    mockStory.current = { id: 'story-1', timelineEpochDay: epochDay, timelineEpochSeconds: 0 };
    const view = await render(<StoryCalendarListScreen />);

    await fireEvent.press(view.getByText('calendar_make_primary'));
    expect(mockAlert).toHaveBeenCalledWith(
      'calendar_epoch_change_title',
      'calendar_epoch_change_message',
      expect.anything(),
    );
    await confirmAlert('calendar_epoch_change_confirm');

    await waitFor(() =>
      expect(mockUpdateStory).toHaveBeenCalledWith('user-1', 'story-1', {
        timelineEpochDay: null,
        timelineEpochSeconds: null,
      }),
    );
    expect(mockSetSelectedStory).toHaveBeenCalled();
    await waitFor(() => expect(mockSetPrimary).toHaveBeenCalledWith('user-1', 'cal-2'));
  });

  it('clears the primary calendar through the same review', async () => {
    mockStory.current = { id: 'story-1', timelineEpochDay: epochDay, timelineEpochSeconds: 0 };
    const view = await render(<StoryCalendarListScreen />);

    await fireEvent.press(view.getByText('calendar_clear_primary'));
    await confirmAlert('calendar_epoch_change_confirm');
    await waitFor(() => expect(mockClearPrimary).toHaveBeenCalledWith('user-1', 'story-1'));
  });

  it('deletes a calendar after confirmation', async () => {
    const view = await render(<StoryCalendarListScreen />);

    await fireEvent.press(view.getAllByText('delete')[1]);
    expect(mockAlert).toHaveBeenCalled();
    await confirmAlert('delete');
    await waitFor(() => expect(mockDeleteCalendar).toHaveBeenCalledWith('user-1', 'cal-2'));
    expect(mockUpdateStory).not.toHaveBeenCalled();
  });

  it('clears the epoch when deleting the primary calendar', async () => {
    mockStory.current = { id: 'story-1', timelineEpochDay: epochDay, timelineEpochSeconds: 0 };
    const view = await render(<StoryCalendarListScreen />);

    await fireEvent.press(view.getAllByText('delete')[0]);
    await confirmAlert('delete');
    await waitFor(() =>
      expect(mockUpdateStory).toHaveBeenCalledWith('user-1', 'story-1', {
        timelineEpochDay: null,
        timelineEpochSeconds: null,
      }),
    );
    await waitFor(() => expect(mockDeleteCalendar).toHaveBeenCalledWith('user-1', 'cal-1'));
  });

  it('saves and clears the epoch in primary-calendar units', async () => {
    mockStory.current = { id: 'story-1', timelineEpochDay: epochDay, timelineEpochSeconds: 3600 };
    const view = await render(<StoryCalendarListScreen />);
    await waitFor(() => expect(view.getByDisplayValue('2')).toBeTruthy());

    await fireEvent.changeText(view.getAllByDisplayValue('1')[1], '3');
    await fireEvent.press(view.getByText('save'));
    const expectedDay = partsToDayNumber(definition, { year: 2, month: 3, day: 1 });
    await waitFor(() =>
      expect(mockUpdateStory).toHaveBeenCalledWith('user-1', 'story-1', {
        timelineEpochDay: expectedDay,
        timelineEpochSeconds: 3600,
      }),
    );
    expect(mockSetSelectedStory).toHaveBeenCalled();

    await fireEvent.press(view.getByText('calendar_epoch_clear'));
    await waitFor(() =>
      expect(mockUpdateStory).toHaveBeenCalledWith('user-1', 'story-1', {
        timelineEpochDay: null,
        timelineEpochSeconds: null,
      }),
    );
  });

  it('rejects non-numeric epoch input', async () => {
    mockStory.current = { id: 'story-1', timelineEpochDay: epochDay, timelineEpochSeconds: 0 };
    const view = await render(<StoryCalendarListScreen />);
    await waitFor(() => expect(view.getByDisplayValue('2')).toBeTruthy());

    await fireEvent.changeText(view.getByDisplayValue('2'), '2x');
    expect(view.getByDisplayValue('2')).toBeTruthy();
    await fireEvent.changeText(view.getByDisplayValue('2'), '-3');
    expect(view.getByDisplayValue('-3')).toBeTruthy();
  });

  it('saves the gregorian epoch through the date picker', async () => {
    mockCalendarState.current = { calendars: [], primary: null, reload: mockReload };
    const view = await render(<StoryCalendarListScreen />);

    await fireEvent.press(view.getByTestId('date-change'));
    await fireEvent.press(view.getByText('save'));
    await waitFor(() =>
      expect(mockUpdateStory).toHaveBeenCalledWith('user-1', 'story-1', {
        timelineEpochDay: gregorianDayNumber({ year: 2026, month: 4, day: 9 }),
        timelineEpochSeconds: 0,
      }),
    );
  });

  it('renders far-future gregorian epochs as text', async () => {
    mockCalendarState.current = { calendars: [], primary: null, reload: mockReload };
    mockStory.current = {
      id: 'story-1',
      timelineEpochDay: gregorianDayNumber({ year: 12000, month: 3, day: 4 }),
      timelineEpochSeconds: 0,
    };
    const view = await render(<StoryCalendarListScreen />);

    expect(view.queryByTestId('date-picker')).toBeNull();
  });

  it('opens and closes the anchors review', async () => {
    const view = await render(<StoryCalendarListScreen />);

    await fireEvent.press(view.getAllByText('calendar_view_anchors')[1]);
    expect(view.getByTestId('anchors-modal').props.children).toBe('Lunar');
    await fireEvent.press(view.getByTestId('anchors-close'));
    expect(view.queryByTestId('anchors-modal')).toBeNull();
  });

  it('notifies when promoting fails', async () => {
    await withSilencedConsole(['log'], async () => {
      mockSetPrimary.mockRejectedValue(new Error('nope'));
      const view = await render(<StoryCalendarListScreen />);

      await fireEvent.press(view.getByText('calendar_make_primary'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('calendar_save_failed', 'error'));
    });
  });
});
