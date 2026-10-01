import { cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockSetChapterIds = jest.fn();
const mockSetScaleMode = jest.fn();
const mockSetEventPlacement = jest.fn();
const mockSetShowEvents = jest.fn();
const mockSetShowSceneNames = jest.fn();
const mockExportTimeline = jest.fn();

interface TimelineState {
  story: { id: string; type: string; title: string } | null;
  loading: boolean;
  saving: boolean;
  chapters: { id: string; name: string; index: number }[];
  scenes: unknown[];
  events: unknown[];
  anchors: unknown[];
  chapterIds: string[];
  scaleMode: 'compact' | 'proportional';
  eventPlacement: 'overlay' | 'inline';
  showEvents: boolean;
  showSceneNames: boolean;
  layout: {
    rows: { id: string }[];
    unanchoredNames: string[];
    hasProportionalScaleWarning: boolean;
  };
}

const baseTimeline = (): TimelineState => ({
  story: { id: 'story-1', type: 'linear', title: 'My Story' },
  loading: false,
  saving: false,
  chapters: [{ id: 'ch-1', name: 'Ch1', index: 0 }],
  scenes: [],
  events: [],
  anchors: [],
  chapterIds: ['ch-1'],
  scaleMode: 'compact',
  eventPlacement: 'overlay',
  showEvents: true,
  showSceneNames: true,
  layout: { rows: [{ id: 'row-1' }], unanchoredNames: [], hasProportionalScaleWarning: false },
});

let mockTimeline: TimelineState = baseTimeline();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));

jest.mock('../../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: () => undefined,
}));

jest.mock('../../../../src/hooks/useStoryTimeline', () => ({
  __esModule: true,
  useStoryTimeline: () => ({
    ...mockTimeline,
    setChapterIds: mockSetChapterIds,
    setScaleMode: mockSetScaleMode,
    setEventPlacement: mockSetEventPlacement,
    setShowEvents: mockSetShowEvents,
    setShowSceneNames: mockSetShowSceneNames,
    dateForRow: () => null,
    describeSceneDay: () => 'day',
    storyDurationLabel: 'dur',
    exportTimeline: mockExportTimeline,
  }),
}));

jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      primary: '#0000ff',
      primaryContainer: '#aaaaff',
      onPrimaryContainer: '#000088',
      surface: '#f5f5f5',
      background: '#ffffff',
      border: '#cccccc',
      text: '#111111',
      textSecondary: '#555555',
      error: '#ff0000',
    },
  }),
}));

jest.mock('../../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    term: (value: string, plural?: boolean) => (plural ? `${value}s` : value),
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('../../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      options,
      selectedValues,
      onSelectionChange,
      placeholder,
      selectionSummary,
    }: {
      options: unknown[];
      selectedValues: string[];
      onSelectionChange: (ids: string[]) => void;
      placeholder: string;
      selectionSummary?: string;
    }) => (
      <>
        <Text testID="chapter-filter">
          {JSON.stringify({
            options,
            selectedValues,
            placeholder,
            selectionSummary: selectionSummary ?? null,
          })}
        </Text>
        <Text testID="chapter-filter-change" onPress={() => onSelectionChange([])}>
          clear
        </Text>
      </>
    ),
  };
});

jest.mock('../../../../src/components/features/story-timeline/StoryTimelineCanvas', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      layout,
      onPressScene,
      onPressEvent,
      showSceneNames,
      storyDurationTitle,
      storyDurationLabel,
    }: {
      layout: { rows: { id: string }[] };
      onPressScene: (id: string) => void;
      onPressEvent: (id: string) => void;
      showSceneNames: boolean;
      storyDurationTitle: string;
      storyDurationLabel: string;
    }) => (
      <>
        <Text testID="timeline-canvas">
          {JSON.stringify({
            rows: layout.rows.map((row) => row.id),
            showSceneNames,
            storyDurationTitle,
            storyDurationLabel,
          })}
        </Text>
        <Text testID="timeline-press-scene" onPress={() => onPressScene('scene-1')}>
          scene
        </Text>
        <Text testID="timeline-press-event" onPress={() => onPressEvent('event-1')}>
          event
        </Text>
      </>
    ),
  };
});

jest.mock('../../../../src/components/features/story-timeline/StoryTimelineSheets', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      scenes,
      chapters,
      events,
      anchors,
      selectedSceneId,
      selectedEventId,
      onSelectScene,
      onSelectEvent,
      onOpenEvent,
      describeSceneDay,
    }: {
      scenes: unknown[];
      chapters: unknown[];
      events: unknown[];
      anchors: unknown[];
      selectedSceneId: string | null;
      selectedEventId: string | null;
      onSelectScene: (id: string | null) => void;
      onSelectEvent: (id: string | null) => void;
      onOpenEvent: (id: string) => void;
      describeSceneDay: () => string;
    }) => (
      <>
        <Text testID="timeline-sheets">
          {JSON.stringify({
            scenes: scenes.length,
            chapters: chapters.length,
            events: events.length,
            anchors: anchors.length,
            selectedSceneId,
            selectedEventId,
            day: describeSceneDay(),
          })}
        </Text>
        <Text testID="sheets-select-scene" onPress={() => onSelectScene('scene-2')}>
          pick-scene
        </Text>
        <Text testID="sheets-select-event" onPress={() => onSelectEvent('event-2')}>
          pick-event
        </Text>
        <Text testID="sheets-open-event" onPress={() => onOpenEvent('event-9')}>
          open-event
        </Text>
      </>
    ),
  };
});

import StoryTimelineScreen from '../../../../src/screens/narrative-elements/timeline/StoryTimelineScreen';

function jsonOf(view: RenderResult, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTimeline = baseTimeline();
});

describe('StoryTimelineScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the branching guard for non-linear stories', async () => {
    mockTimeline = { ...baseTimeline(), story: { id: 'story-1', type: 'branching', title: 'B' } };
    const view = await render(<StoryTimelineScreen />);
    expect(view.getByText('story_timeline_branching_unavailable')).toBeTruthy();
    expect(view.queryByTestId('timeline-canvas')).toBeNull();
  });

  it('renders the loading indicator', async () => {
    mockTimeline = { ...baseTimeline(), loading: true };
    const view = await render(<StoryTimelineScreen />);
    expect(view.queryByText('story_timeline_gap')).toBeNull();
    expect(view.queryByTestId('timeline-canvas')).toBeNull();
  });

  it('renders the filter, legend, canvas and sheets', async () => {
    const view = await render(<StoryTimelineScreen />);
    expect(jsonOf(view, 'chapter-filter')).toMatchObject({
      selectedValues: ['ch-1'],
      placeholder: 'Chapters',
      selectionSummary: 'story_timeline_all_chapters',
    });
    expect(jsonOf(view, 'chapter-filter').options).toEqual([
      { label: 'Ch1', value: 'ch-1', color: expect.any(String) },
    ]);
    expect(view.getByText('story_timeline_gap')).toBeTruthy();
    expect(view.getByText('story_timeline_duration')).toBeTruthy();
    expect(view.getByText(/story_timeline_compressed/)).toBeTruthy();
    expect(jsonOf(view, 'timeline-canvas')).toMatchObject({
      rows: ['row-1'],
      showSceneNames: true,
      storyDurationTitle: 'story_timeline_story_duration',
      storyDurationLabel: 'dur',
    });
    expect(jsonOf(view, 'timeline-sheets')).toMatchObject({
      selectedSceneId: null,
      selectedEventId: null,
      day: 'day',
    });
  });

  it('forwards chapter filter changes', async () => {
    const view = await render(<StoryTimelineScreen />);
    await fireEvent.press(view.getByTestId('chapter-filter-change'));
    expect(mockSetChapterIds).toHaveBeenCalledWith([]);
  });

  it('omits the all-chapters summary for partial selection', async () => {
    mockTimeline = {
      ...baseTimeline(),
      chapters: [
        { id: 'ch-1', name: 'Ch1', index: 0 },
        { id: 'ch-2', name: 'Ch2', index: 1 },
      ],
      chapterIds: ['ch-1'],
    };
    const view = await render(<StoryTimelineScreen />);
    expect(jsonOf(view, 'chapter-filter').selectionSummary).toBeNull();
  });

  it('switches scale modes', async () => {
    const view = await render(<StoryTimelineScreen />);
    await fireEvent.press(view.getByText('story_timeline_scale_proportional'));
    expect(mockSetScaleMode).toHaveBeenCalledWith('proportional');
    await fireEvent.press(view.getByText('story_timeline_scale_compact'));
    expect(mockSetScaleMode).toHaveBeenCalledWith('compact');
  });

  it('shows the proportional legend in proportional mode', async () => {
    mockTimeline = { ...baseTimeline(), scaleMode: 'proportional' };
    const view = await render(<StoryTimelineScreen />);
    expect(view.getByText('story_timeline_proportional_legend')).toBeTruthy();
  });

  it('toggles event visibility and placement', async () => {
    const view = await render(<StoryTimelineScreen />);
    expect(view.getByText('story_timeline_events_inline')).toBeTruthy();
    await fireEvent.press(view.getByText('story_timeline_show_events'));
    expect(mockSetShowEvents).toHaveBeenCalledWith(expect.any(Function));
    await fireEvent.press(view.getByText('story_timeline_events_inline'));
    expect(mockSetEventPlacement).toHaveBeenCalledWith(expect.any(Function));
    const togglePlacement = mockSetEventPlacement.mock.calls[0][0] as (
      current: 'overlay' | 'inline',
    ) => string;
    expect(togglePlacement('overlay')).toBe('inline');
    expect(togglePlacement('inline')).toBe('overlay');
  });

  it('hides the placement toggle when events are hidden', async () => {
    mockTimeline = { ...baseTimeline(), showEvents: false };
    const view = await render(<StoryTimelineScreen />);
    expect(view.queryByText('story_timeline_events_inline')).toBeNull();
  });

  it('toggles scene names', async () => {
    const view = await render(<StoryTimelineScreen />);
    await fireEvent.press(view.getByText('story_timeline_show_names'));
    expect(mockSetShowSceneNames).toHaveBeenCalledWith(expect.any(Function));
  });

  it('warns about unanchored events and proportional scale', async () => {
    mockTimeline = {
      ...baseTimeline(),
      layout: {
        rows: [{ id: 'row-1' }],
        unanchoredNames: ['Ghost', 'Rumor'],
        hasProportionalScaleWarning: true,
      },
    };
    const view = await render(<StoryTimelineScreen />);
    expect(view.getByText(/story_timeline_unanchored/)).toBeTruthy();
    expect(view.getByText(/Ghost, Rumor/)).toBeTruthy();
    expect(view.getByText('story_timeline_proportional_warning')).toBeTruthy();
  });

  it('renders the empty state without rows', async () => {
    mockTimeline = {
      ...baseTimeline(),
      layout: { rows: [], unanchoredNames: [], hasProportionalScaleWarning: false },
    };
    const view = await render(<StoryTimelineScreen />);
    expect(view.getByText('story_timeline_no_scenes')).toBeTruthy();
    expect(view.queryByTestId('timeline-canvas')).toBeNull();
  });

  it('selects scenes and events through the canvas', async () => {
    const view = await render(<StoryTimelineScreen />);
    await fireEvent.press(view.getByTestId('timeline-press-scene'));
    expect(jsonOf(view, 'timeline-sheets')).toMatchObject({
      selectedSceneId: 'scene-1',
      selectedEventId: null,
    });
    await fireEvent.press(view.getByTestId('timeline-press-event'));
    expect(jsonOf(view, 'timeline-sheets')).toMatchObject({
      selectedSceneId: null,
      selectedEventId: 'event-1',
    });
  });

  it('selects through the sheets and opens events in the detail screen', async () => {
    const view = await render(<StoryTimelineScreen />);
    await fireEvent.press(view.getByTestId('sheets-select-scene'));
    expect(jsonOf(view, 'timeline-sheets').selectedSceneId).toBe('scene-2');
    await fireEvent.press(view.getByTestId('sheets-select-event'));
    expect(jsonOf(view, 'timeline-sheets').selectedEventId).toBe('event-2');
    await fireEvent.press(view.getByTestId('sheets-open-event'));
    expect(mockNavigate).toHaveBeenCalledWith('ChapterDetail', { chapterId: 'event-9' });
  });

  it('wires the canvas controls and export', async () => {
    const view = await render(<StoryTimelineScreen />);
    await fireEvent.press(view.getByLabelText('zoom_in'));
    await fireEvent.press(view.getByLabelText('zoom_out'));
    await fireEvent.press(view.getByLabelText('fit_to_screen'));
    await fireEvent.press(view.getByLabelText('story_timeline_export_image'));
    expect(mockExportTimeline).toHaveBeenCalledTimes(1);
  });

  it('disables controls while saving', async () => {
    mockTimeline = { ...baseTimeline(), saving: true };
    const view = await render(<StoryTimelineScreen />);
    await fireEvent.press(view.getByLabelText('story_timeline_export_image'));
    expect(mockExportTimeline).not.toHaveBeenCalled();
  });
});
