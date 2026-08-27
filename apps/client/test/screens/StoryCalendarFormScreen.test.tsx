import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

/**
 * That the calendar form **mounts**, and the two rules it owns.
 *
 * The mount is the point. This screen built its initial state with
 * `CalendarDefinitionSchema.parse`, and the schema required a month name - so a form that starts
 * with two blank months threw inside its own `useState` initialiser. The screen crashed before it
 * drew anything, and the button that opened it looked inert. Nothing else in the suite touched it,
 * because everything else tested the schema and the service with values that were already valid.
 */

jest.mock('../../src/theme', () => ({
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
      shadow: '#000',
      secondary: '#888',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  const value = { t };
  return { __esModule: true, useTranslation: () => value };
});

const mockGoBack = jest.fn();
const mockRouteParams: { value: { calendarId?: string } | undefined } = { value: undefined };
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams.value }),
}));

jest.mock('../../src/db', () => {
  const db = {};
  return { __esModule: true, useDrizzle: () => db };
});
jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../src/utils/documentTitle', () => ({
  __esModule: true,
  setDocumentTitle: () => undefined,
}));
jest.mock('../../src/state/notificationStore', () => {
  const state = { showNotification: jest.fn() };
  return {
    __esModule: true,
    useNotificationStore: (selector: (value: typeof state) => unknown) => selector(state),
  };
});
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: '01ARZ3NDEKTSV4RRFFQ69G5FUS' }),
}));
jest.mock('../../src/state/storyStore', () => {
  const state = { selectedStory: { id: '01ARZ3NDEKTSV4RRFFQ69G5FUT', title: 'A story' } };
  return {
    __esModule: true,
    useStoryStore: (selector: (value: typeof state) => unknown) => selector(state),
  };
});
jest.mock('../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({
    canEdit: true,
    role: 'owner',
    canManageStoryPolicy: true,
    loading: false,
  }),
}));

const mockCreateCalendar = jest.fn(async () => ({ id: 'calendar-1' }));
const mockUpdateCalendar = jest.fn(async () => ({ id: 'calendar-1' }));
const mockGetById = jest.fn(async () => undefined as unknown);
jest.mock('../../src/services/storymanagement/StoryCalendarService', () => ({
  __esModule: true,
  createStoryCalendarService: () => ({
    createCalendar: mockCreateCalendar,
    updateCalendar: mockUpdateCalendar,
    getById: mockGetById,
  }),
}));

import StoryCalendarFormScreen from '../../src/screens/storycalendars/StoryCalendarFormScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams.value = undefined;
});

describe('opening the calendar form', () => {
  it('mounts for a new calendar without throwing', async () => {
    const screen = await render(<StoryCalendarFormScreen />);

    // Two blank months: what a writer is handed before naming anything.
    expect(screen.getByText('calendar_months')).toBeTruthy();
    expect(screen.getByText('calendar_name')).toBeTruthy();
  });

  it('starts with a year the writer can already see the length of', async () => {
    const screen = await render(<StoryCalendarFormScreen />);

    expect(screen.getByText('calendar_year_summary')).toBeTruthy();
  });

  it('refuses to save a calendar with no name', async () => {
    const screen = await render(<StoryCalendarFormScreen />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-calendar-save'));
    });

    expect(mockCreateCalendar).not.toHaveBeenCalled();
  });

  it('saves a named calendar, keeping the months it was given', async () => {
    const screen = await render(<StoryCalendarFormScreen />);

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('calendar_name_placeholder'), 'Reckoning');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-calendar-save'));
    });

    expect(mockCreateCalendar).toHaveBeenCalledTimes(1);
    const [, payload] = mockCreateCalendar.mock.calls[0] as unknown as [
      string,
      { name: string; definition: { months: unknown[] } },
    ];
    expect(payload.name).toBe('Reckoning');
    expect(payload.definition.months).toHaveLength(2);
  });
});
