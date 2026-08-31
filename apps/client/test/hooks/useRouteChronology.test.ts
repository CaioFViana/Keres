const mockStoryRoutes = jest.fn();
const mockStoryCalendar = jest.fn();
const mockSelectedStory = jest.fn();
const mockDateFormat = jest.fn();

jest.mock('../../src/hooks/useStoryRoutes', () => ({
  __esModule: true,
  useStoryRoutes: (...args: unknown[]) => mockStoryRoutes(...args),
}));
jest.mock('../../src/hooks/useStoryCalendar', () => ({
  __esModule: true,
  useStoryCalendar: (...args: unknown[]) => mockStoryCalendar(...args),
}));
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: unknown) => unknown) =>
    selector({ selectedStory: mockSelectedStory() }),
}));
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({ dateDisplayFormat: mockDateFormat() }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { renderHook } from '@testing-library/react-native';
import { useRouteChronology } from '../../src/hooks/useRouteChronology';

const firstScene = {
  id: 'scene-a',
  name: 'Beginning',
  chapterId: 'chapter',
  isDeleted: false,
  gap: 12,
  gapType: 'hours',
  duration: 1,
  durationType: 'hours',
  calendarDateOverride: null,
} as never;
const secondScene = {
  id: 'scene-b',
  name: 'Arrival',
  chapterId: 'chapter',
  isDeleted: false,
  gap: 2,
  gapType: 'hours',
  duration: 1,
  durationType: 'hours',
  calendarDateOverride: null,
} as never;
const steps = [
  { id: 'visit-a', routeId: 'route', sceneId: 'scene-a', position: 1, isDeleted: false },
  { id: 'visit-b', routeId: 'route', sceneId: 'scene-b', position: 2, isDeleted: false },
] as never;

beforeEach(() => {
  mockSelectedStory.mockReturnValue({ id: 'story', timelineEpochDay: 0, timelineEpochSeconds: 0 });
  mockDateFormat.mockReturnValue('iso');
  mockStoryCalendar.mockReturnValue({ definition: null, calendars: [] });
  mockStoryRoutes.mockReturnValue({
    routes: [{ id: 'route', storyId: 'story' }],
    scenes: [firstScene, secondScene],
    stepsOf: jest.fn(() => steps),
    validationOf: jest.fn(() => []),
    sceneById: jest.fn((id: string) =>
      ([firstScene, secondScene] as Array<{ id: string }>).find((scene) => scene.id === id),
    ),
    chapterNameOf: jest.fn(() => 'Chapter one'),
  });
});

describe('useRouteChronology', () => {
  it('gives every RouteStep its own chronological row and a Gregorian date when no custom calendar exists', async () => {
    const view = await renderHook(() => useRouteChronology('route'));

    expect(view.result.current.layout.rows.map((row) => row.id)).toEqual(['visit-a', 'visit-b']);
    expect(view.result.current.layout.rows[1].elapsedSeconds).toBe(3 * 60 * 60);
    expect(view.result.current.dateForRow(0)).toMatch(/00:00$/);
    expect(view.result.current.sceneForStep('visit-b')).toBe(secondScene);
    expect(view.result.current.route?.id).toBe('route');
  });

  it('does not invent a date before the story opening has been anchored', async () => {
    mockSelectedStory.mockReturnValue({
      id: 'story',
      timelineEpochDay: null,
      timelineEpochSeconds: null,
    });
    const view = await renderHook(() => useRouteChronology('route'));

    expect(view.result.current.dateForRow(0)).toBeNull();
  });
});
