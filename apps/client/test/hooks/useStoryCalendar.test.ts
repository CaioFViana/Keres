const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/services/storymanagement/StoryCalendarService', () => ({
  __esModule: true,
  createStoryCalendarService: jest.fn(),
}));
jest.mock('../../src/hooks/useEntityRefreshLifecycle', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useEntityInitialLoad: (load: () => Promise<void>) =>
      React.useEffect(() => {
        void load();
      }, [load]),
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createStoryCalendarService } from '../../src/services/storymanagement/StoryCalendarService';
import { useStoryCalendar } from '../../src/hooks/useStoryCalendar';
import { useStoryStore } from '../../src/state/storyStore';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const definition = {
  secondsPerMinute: 60,
  minutesPerHour: 60,
  hoursPerDay: 24,
  daysPerWeek: 7,
  weekdayNames: ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'],
  unitNames: {},
  months: [{ name: 'First', days: 30 }],
  eras: [],
  moons: [],
  seasons: [],
};
const primary = { id: 'primary', storyId: 'story', definition, isPrimary: true } as never;
const parallel = { id: 'parallel', storyId: 'story', definition, isPrimary: false } as never;

beforeEach(() => {
  jest.clearAllMocks();
  useStoryStore.getState().setSelectedStory({ id: 'story' } as never);
  (createStoryCalendarService as jest.Mock).mockReturnValue({
    getCalendarsForStory: jest.fn().mockResolvedValue([parallel, primary]),
    getPrimary: jest.fn().mockResolvedValue(primary),
  });
});

afterEach(() => {
  useStoryStore.getState().setSelectedStory(null);
});

describe('useStoryCalendar', () => {
  it('keeps the persisted primary row as the calendar identity and derives its day description', async () => {
    const view = await renderHook(() => useStoryCalendar());
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    expect(view.result.current.primary).toBe(primary);
    expect(view.result.current.definition).toBe(definition);
    expect(view.result.current.describeDay(0)).toMatchObject({
      date: '1 First, 1',
      weekday: 'One',
    });
  });

  it('refreshes when the sync engine announces a calendar change', async () => {
    const view = await renderHook(() => useStoryCalendar());
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    const service = (createStoryCalendarService as jest.Mock).mock.results.at(-1)!.value;

    await act(async () => {
      entityEventEmitter.emit('story_calendar_changed', 'story');
    });
    await waitFor(() => expect(service.getPrimary).toHaveBeenCalledTimes(2));
    await view.unmount();
  });

  it('clears all derived state when no story is selected', async () => {
    useStoryStore.getState().setSelectedStory(null);
    const view = await renderHook(() => useStoryCalendar());
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current).toMatchObject({
      calendars: [],
      definition: null,
      primary: undefined,
    });
    expect(view.result.current.describeDay(0)).toBeNull();
  });
});
