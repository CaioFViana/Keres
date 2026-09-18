import { act, render } from '@testing-library/react-native';
import React from 'react';
import StoryTimelineCanvas from '../../src/components/features/story-timeline/StoryTimelineCanvas';
import StoryTimelineSheets from '../../src/components/features/story-timeline/StoryTimelineSheets';
import type { ChapterAnchorSelect, ChapterSelect, SceneSelect } from '../../src/db/schema';
import {
  TIMELINE_EVENT_LANE_HEIGHT,
  TIMELINE_PADDING,
  TIMELINE_ROW_HEIGHT,
  type StoryTimelineLayout,
} from '@keres/shared/graphs/storyTimelineLayout';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockViewportOptions = { current: null as Record<string, any> | null };
jest.mock('../../src/hooks/useCanvasViewport', () => ({
  __esModule: true,
  useCanvasViewport: (_ref: unknown, _layout: unknown, options: Record<string, unknown>) => {
    mockViewportOptions.current = options as Record<string, any>;
    return {
      containerRef: { current: null },
      handleLayout: jest.fn(),
      panHandlers: {},
      animatedTransform: [],
      renderWindow: { x: -100000, y: -100000, width: 200000, height: 200000 },
    };
  },
}));

jest.mock('../../src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(View, null, children),
  };
});

jest.mock('../../src/components/features/graphs/CanvasLine/CanvasLine', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, { testID: 'canvas-line', ...props }),
  };
});

const mockSheetProps: Record<string, any>[] = [];
jest.mock('../../src/components/features/graphs/GraphNodeSheet/GraphNodeSheet', () => {
  const ReactActual = require('react');
  const { Text, View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, any>) => {
      mockSheetProps.push(props);
      return ReactActual.createElement(
        View,
        { testID: 'graph-node-sheet' },
        ReactActual.createElement(Text, null, props.title),
      );
    },
  };
});

jest.mock('../../src/hooks/useStoryCalendar', () => ({
  __esModule: true,
  useStoryCalendar: () => ({ definition: null }),
}));

jest.mock('../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    term: (type: string, plural = false) => (plural ? `${type}s` : type),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockViewportOptions.current = null;
  mockSheetProps.length = 0;
});

const LONG_EVENT_NAME = 'An era whose name runs far past twenty-eight characters';

const timelineLayout = (overrides: Partial<StoryTimelineLayout> = {}): StoryTimelineLayout =>
  ({
    rows: [
      {
        id: 'scene-1',
        chapterId: 'ch-1',
        sequence: 1,
        name: 'Scene 1',
        chapterName: 'Chapter 1',
        chapterColor: '#111',
        barStart: 300,
        barEnd: 420,
        gapStart: 250,
        gapEnd: 300,
        gap: { value: 1, unit: 'days', label: '1d' },
        duration: { value: 2, unit: 'hours', label: '2h' },
        kind: 'scene',
        elapsedSeconds: 90,
      },
      {
        id: 'row-ev',
        chapterId: 'ev-1',
        sequence: 2,
        name: 'Flash',
        chapterName: 'Event',
        chapterColor: '#222',
        barStart: 500,
        barEnd: 500,
        kind: 'event',
        instant: true,
      },
    ],
    chapters: [
      {
        id: 'ch-1',
        name: 'Chapter 1',
        color: '#111',
        durationLabel: '3h',
        start: 300,
        end: 800,
        lane: 0,
      },
    ],
    eventSpans: [
      {
        id: 'ev-1',
        name: LONG_EVENT_NAME,
        color: '#222',
        isEvent: true,
        stretchIndex: 0,
        start: 300,
        end: 500,
        lane: 0,
      },
      {
        id: 'ev-1',
        name: LONG_EVENT_NAME,
        color: '#222',
        isEvent: true,
        stretchIndex: 1,
        start: 600,
        end: 700,
        lane: 0,
      },
      {
        id: 'ev-2',
        name: 'Instant',
        color: '#333',
        isEvent: true,
        stretchIndex: 0,
        start: 750,
        end: 750,
        lane: 0,
        instant: true,
      },
    ],
    eventLaneCount: 1,
    unanchoredNames: [],
    rulerTicks: [{ x: 300, label: 'day 0' }],
    headerHeight: 82,
    chapterLaneCount: 1,
    width: 1200,
    height: 600,
    scaleMode: 'proportional',
    hasProportionalScaleWarning: false,
    ...overrides,
  }) as StoryTimelineLayout;

describe('StoryTimelineCanvas', () => {
  const canvasProps = () => ({
    layout: timelineLayout(),
    onPressScene: jest.fn(),
    onPressEvent: jest.fn(),
    showSceneNames: false,
    dateForRow: (_elapsed: number) => 'Day 2',
    storyDurationLabel: '3 days',
    storyDurationTitle: 'Story length',
  });

  it('labels the rows with their sequence, chapter and date', async () => {
    const screen = await render(<StoryTimelineCanvas {...canvasProps()} />);

    expect(screen.getByText('1. Scene 1')).toBeTruthy();
    expect(screen.getByText('Chapter 1')).toBeTruthy();
    expect(screen.getByText('Day 2')).toBeTruthy();
    expect(screen.getByText('1d')).toBeTruthy();
    expect(screen.getByText('2h')).toBeTruthy();
  });

  it('names the scene inside its bar when asked', async () => {
    const plain = await render(<StoryTimelineCanvas {...canvasProps()} />);
    expect(plain.getAllByText('1. Scene 1')).toHaveLength(1);

    const named = await render(<StoryTimelineCanvas {...canvasProps()} showSceneNames />);
    // Once in the row label, once over the bar itself.
    expect(named.getAllByText('1. Scene 1')).toHaveLength(2);
  });

  it('rules the proportional axis with ticks', async () => {
    const screen = await render(<StoryTimelineCanvas {...canvasProps()} />);

    expect(screen.getByText('day 0')).toBeTruthy();
  });

  it('summarizes the compact scale with the total and the chapters', async () => {
    const screen = await render(
      <StoryTimelineCanvas {...canvasProps()} layout={timelineLayout({ scaleMode: 'compact' })} />,
    );

    expect(screen.getByText('Story length: 3 days')).toBeTruthy();
    expect(screen.getByText('3h')).toBeTruthy();
    expect(screen.queryByText('day 0')).toBeNull();
  });

  it('truncates long container names and names each only once', async () => {
    const screen = await render(<StoryTimelineCanvas {...canvasProps()} />);

    expect(screen.getByText(`${LONG_EVENT_NAME.slice(0, 27)}…`)).toBeTruthy();
    expect(screen.queryByText(LONG_EVENT_NAME)).toBeNull();
    expect(screen.getByText('Instant')).toBeTruthy();
  });

  it('opens the event span that is tapped', async () => {
    const props = canvasProps();
    await render(<StoryTimelineCanvas {...props} />);
    const headerBaseY = TIMELINE_PADDING + props.layout.headerHeight;

    await act(async () => {
      mockViewportOptions.current?.onTap({ x: 350, y: headerBaseY + 5 });
    });

    expect(props.onPressEvent).toHaveBeenCalledWith('ev-1');
    expect(props.onPressScene).not.toHaveBeenCalled();
  });

  it('opens instant spans with a forgiving touch area', async () => {
    const props = canvasProps();
    await render(<StoryTimelineCanvas {...props} />);
    const headerBaseY = TIMELINE_PADDING + props.layout.headerHeight;

    await act(async () => {
      mockViewportOptions.current?.onTap({ x: 755, y: headerBaseY + 5 });
    });

    expect(props.onPressEvent).toHaveBeenCalledWith('ev-2');
  });

  it('opens the scene row that is tapped', async () => {
    const props = canvasProps();
    await render(<StoryTimelineCanvas {...props} />);
    const startY = TIMELINE_PADDING + props.layout.headerHeight + TIMELINE_EVENT_LANE_HEIGHT;

    await act(async () => {
      mockViewportOptions.current?.onTap({ x: 500, y: startY + 10 });
    });

    expect(props.onPressScene).toHaveBeenCalledWith('scene-1');
  });

  it('opens the event behind an event-kind row', async () => {
    const props = canvasProps();
    await render(<StoryTimelineCanvas {...props} />);
    const startY = TIMELINE_PADDING + props.layout.headerHeight + TIMELINE_EVENT_LANE_HEIGHT;

    await act(async () => {
      mockViewportOptions.current?.onTap({ x: 500, y: startY + TIMELINE_ROW_HEIGHT + 10 });
    });

    expect(props.onPressEvent).toHaveBeenCalledWith('ev-1');
    expect(props.onPressScene).not.toHaveBeenCalled();
  });

  it('ignores taps that land on nothing', async () => {
    const props = canvasProps();
    await render(<StoryTimelineCanvas {...props} />);

    await act(async () => {
      mockViewportOptions.current?.onTap({ x: 500, y: 50000 });
    });

    expect(props.onPressEvent).not.toHaveBeenCalled();
    expect(props.onPressScene).not.toHaveBeenCalled();
  });

  it('leaves spans alone when events do not open', async () => {
    const props = { ...canvasProps(), onPressEvent: undefined };
    await render(<StoryTimelineCanvas {...props} />);
    const headerBaseY = TIMELINE_PADDING + props.layout.headerHeight;

    await act(async () => {
      mockViewportOptions.current?.onTap({ x: 350, y: headerBaseY + 5 });
    });

    expect(props.onPressScene).not.toHaveBeenCalled();
  });
});

describe('StoryTimelineSheets', () => {
  const sceneRow = (overrides: Partial<SceneSelect> = {}): SceneSelect =>
    ({
      id: 'scene-1',
      storyId: 'story-1',
      name: 'Scene 1',
      chapterId: 'ch-1',
      index: 0,
      summary: 'It begins.',
      gap: 1,
      gapType: 'days',
      duration: 2,
      durationType: 'hours',
      isDeleted: false,
      ...overrides,
    }) as SceneSelect;

  const chapterRow = (overrides: Partial<ChapterSelect> = {}): ChapterSelect =>
    ({
      id: 'ch-1',
      storyId: 'story-1',
      name: 'Chapter 1',
      type: 'chapter',
      index: 0,
      isDeleted: false,
      ...overrides,
    }) as ChapterSelect;

  const anchorRow = (overrides: Partial<ChapterAnchorSelect> = {}): ChapterAnchorSelect =>
    ({
      id: 'anchor-1',
      storyId: 'story-1',
      chapterId: 'ev-1',
      order: 0,
      startSceneId: 'scene-1',
      startPosition: 'start',
      startOffset: 2,
      startOffsetUnit: 'days',
      endSceneId: 'scene-2',
      endPosition: 'end',
      endOffset: null,
      endOffsetUnit: null,
      ...overrides,
    }) as ChapterAnchorSelect;

  const sheetsProps = () => ({
    scenes: [
      sceneRow(),
      sceneRow({ id: 'scene-2', name: 'Scene 2', chapterId: 'ev-1', index: 1, summary: null }),
    ],
    chapters: [chapterRow()],
    events: [chapterRow({ id: 'ev-1', name: 'Era', type: 'event' })],
    anchors: [anchorRow()],
    selectedSceneId: null as string | null,
    selectedEventId: null as string | null,
    onSelectScene: jest.fn(),
    onSelectEvent: jest.fn(),
    onOpenEvent: jest.fn(),
    describeSceneDay: undefined as
      | ((sceneId: string) => {
          date: string;
          weekday: string | null;
          season: string | null;
          moons: { name: string; phase: number }[];
        } | null)
      | undefined,
  });

  it('shows nothing until something is selected', async () => {
    const screen = await render(<StoryTimelineSheets {...sheetsProps()} />);

    expect(screen.queryByTestId('graph-node-sheet')).toBeNull();
  });

  it('shows the scene timing with its chapter', async () => {
    const screen = await render(
      <StoryTimelineSheets {...sheetsProps()} selectedSceneId="scene-1" />,
    );

    expect(screen.getByText('Scene 1')).toBeTruthy();
    const sheet = mockSheetProps[0];
    expect(sheet.subtitle).toEqual({ text: 'Chapter 1' });
    expect(sheet.badges[0].label).toBe('story_timeline_gap: scene_time_days');
    expect(sheet.badges[1].label).toBe('story_timeline_duration: scene_time_hours');
    expect(sheet.sections).toEqual([{ title: 'summary', description: 'It begins.' }]);
    expect(sheet.actionLabel).toBe('close');
  });

  it('falls back for a scene without a summary', async () => {
    await render(<StoryTimelineSheets {...sheetsProps()} selectedSceneId="scene-2" />);

    expect(mockSheetProps[0].sections).toEqual([{ title: 'summary', description: 'common_na' }]);
  });

  it('badges the in-world day when the story can say it', async () => {
    const props = sheetsProps();
    props.describeSceneDay = () => ({
      date: 'Day 5',
      weekday: 'Monday',
      season: 'Spring',
      moons: [{ name: 'Luna', phase: 2 }],
    });
    await render(<StoryTimelineSheets {...props} selectedSceneId="scene-1" />);

    const labels = (mockSheetProps[0].badges as { label: string }[]).map((badge) => badge.label);
    expect(labels).toContain('Day 5');
    expect(labels).toContain('Monday');
    expect(labels).toContain('Spring');
    expect(labels).toContain('Luna: moon_phase_2');
  });

  it('closes the scene sheet from its action or its close', async () => {
    const props = sheetsProps();
    await render(<StoryTimelineSheets {...props} selectedSceneId="scene-1" />);

    await act(async () => {
      mockSheetProps[0].onAction();
    });
    expect(props.onSelectScene).toHaveBeenCalledWith(null);

    await act(async () => {
      mockSheetProps[0].onClose();
    });
    expect(props.onSelectScene).toHaveBeenCalledTimes(2);
  });

  it('shows the event anchors and the scenes they hold', async () => {
    const screen = await render(<StoryTimelineSheets {...sheetsProps()} selectedEventId="ev-1" />);

    expect(screen.getByText('Era')).toBeTruthy();
    const sheet = mockSheetProps[0];
    expect(sheet.subtitle).toEqual({ text: 'story_timeline_event' });
    expect(sheet.sections[0].description).toBe('anchor_sentence');
    expect(sheet.sections[1].title).toBe('Scenes');
    expect(sheet.sections[1].items).toHaveLength(1);
  });

  it('phrases open and instant anchors honestly', async () => {
    const props = sheetsProps();
    props.anchors = [anchorRow({ endSceneId: null })];
    await render(<StoryTimelineSheets {...props} selectedEventId="ev-1" />);
    expect(mockSheetProps[0].sections[0].description).toBe('anchor_sentence_open');

    mockSheetProps.length = 0;
    const propsInstant = sheetsProps();
    propsInstant.anchors = [anchorRow({ endSceneId: null })];
    propsInstant.scenes = [sceneRow()];
    await render(<StoryTimelineSheets {...propsInstant} selectedEventId="ev-1" />);
    expect(mockSheetProps[0].sections[0].description).toBe('anchor_sentence_instant');
  });

  it('says so when the event has no anchors at all', async () => {
    const props = sheetsProps();
    props.anchors = [];
    await render(<StoryTimelineSheets {...props} selectedEventId="ev-1" />);

    expect(mockSheetProps[0].sections[0].description).toBe('anchor_empty');
  });

  it('jumps from the event to one of its scenes', async () => {
    const props = sheetsProps();
    await render(<StoryTimelineSheets {...props} selectedEventId="ev-1" />);

    await act(async () => {
      mockSheetProps[0].sections[1].items[0].onPress();
    });

    expect(props.onSelectEvent).toHaveBeenCalledWith(null);
    expect(props.onSelectScene).toHaveBeenCalledWith('scene-2');
  });

  it('opens the event from the sheet action and closes behind it', async () => {
    const props = sheetsProps();
    await render(<StoryTimelineSheets {...props} selectedEventId="ev-1" />);
    expect(mockSheetProps[0].actionLabel).toBe('story_timeline_open_event');

    await act(async () => {
      mockSheetProps[0].onAction();
    });

    expect(props.onSelectEvent).toHaveBeenCalledWith(null);
    expect(props.onOpenEvent).toHaveBeenCalledWith('ev-1');
  });
});
