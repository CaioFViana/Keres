import { act, fireEvent, render } from '@testing-library/react-native';
import { buildReorderItems } from '@keres/shared';
import React from 'react';
import RelatedScenesList from '../../src/components/features/scenes/RelatedScenesList/RelatedScenesList';
import SceneNavigationControls from '../../src/components/features/scenes/SceneNavigationControls/SceneNavigationControls';
import ScenePresenceList, {
  groupScenePresenceEntries,
} from '../../src/components/features/scenes/ScenePresenceList/ScenePresenceList';
import SceneReorderModal from '../../src/components/features/scenes/SceneReorderModal/SceneReorderModal';
import SceneTimingFields from '../../src/components/features/scenes/SceneTimingFields';
import type { SceneSelect } from '../../src/db/schema';

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

jest.mock('../../src/components/common/forms/FormField/FormField', () => {
  const ReactActual = require('react');
  const { Text, View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ label, help, children }: { label: string; help?: string; children: any }) =>
      ReactActual.createElement(
        View,
        null,
        ReactActual.createElement(Text, null, label),
        typeof children === 'function' ? children({}) : children,
        help ? ReactActual.createElement(Text, null, help) : null,
      ),
  };
});

jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    SingleSelectPill: (props: Record<string, any>) =>
      ReactActual.createElement(View, {
        testID: `single-select-${String(props.placeholder ?? 'plain')}`,
        ...props,
      }),
  };
});

jest.mock('../../src/components/common/inputs/TextInput/TextInput', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, any>) =>
      ReactActual.createElement(View, {
        testID: `input-${String(props.placeholder ?? 'plain')}`,
        ...props,
      }),
  };
});

const mockChapterNameOf = jest.fn();
jest.mock('../../src/hooks/useChapterNames', () => ({
  __esModule: true,
  useChapterNames: () => mockChapterNameOf,
}));

const mockNavigate = jest.fn();
jest.mock('../../src/hooks/useNavigateToEntityDetail', () => ({
  __esModule: true,
  useNavigateToEntityDetail: () => mockNavigate,
}));

jest.mock('../../src/vocabulary/useVocabularyEntityCopy', () => ({
  __esModule: true,
  useVocabularyEntityCopy: () => ({ entity: 'Chapter' }),
}));

jest.mock('../../src/hooks/useBindChapterStore', () => ({
  __esModule: true,
  useBindChapterStore: () => ({
    chapters: [
      { id: 'ch-1', name: 'Chapter 1' },
      { id: 'ch-2', name: 'Chapter 2' },
    ],
  }),
}));

const mockReorderProps = { current: null as Record<string, any> | null };
jest.mock('../../src/components/common/modals/ReorderModal/ReorderModal', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockReorderProps.current = props as Record<string, any>;
      // The chapter picker arrives as headerExtra; render it like the real modal does.
      const header = (props as Record<string, any>).headerExtra ?? null;
      return ReactActual.createElement(View, { testID: 'reorder-modal' }, header);
    },
  };
});

const mockNavNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: mockNavNavigate }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockReorderProps.current = null;
  mockChapterNameOf.mockImplementation((chapterId: string | null | undefined) =>
    chapterId === 'ch-1' ? 'Chapter One' : undefined,
  );
});

const scene = (overrides: Partial<SceneSelect> = {}): SceneSelect =>
  ({
    id: 'scene-1',
    storyId: 'story-1',
    name: 'First',
    chapterId: 'ch-1',
    index: 0,
    isDeleted: false,
    ...overrides,
  }) as SceneSelect;

describe('SceneTimingFields', () => {
  const timingProps = () => ({
    gapInput: '',
    onGapInputChange: jest.fn(),
    gapType: null as string | null,
    onGapTypeChange: jest.fn(),
    durationInput: '',
    onDurationInputChange: jest.fn(),
    durationType: null as string | null,
    onDurationTypeChange: jest.fn(),
    calendarDateOverride: '',
    onCalendarDateOverrideChange: jest.fn(),
    calendarDateOverrideCalendarId: null as string | null,
    onCalendarDateOverrideCalendarIdChange: jest.fn(),
    calendars: [{ id: 'cal-1', name: 'Custom' }],
    inputStyle: {},
  });

  it('accepts timing digits and rejects anything else', async () => {
    const props = timingProps();
    const screen = await render(<SceneTimingFields {...props} />);

    await act(async () => {
      screen.getByTestId('input-gap_placeholder').props.onChangeText('12');
    });
    expect(props.onGapInputChange).toHaveBeenCalledWith('12');

    await act(async () => {
      screen.getByTestId('input-gap_placeholder').props.onChangeText('1x');
    });
    expect(props.onGapInputChange).toHaveBeenCalledTimes(1);

    await act(async () => {
      screen.getByTestId('input-duration_placeholder').props.onChangeText('-3');
    });
    expect(props.onDurationInputChange).toHaveBeenCalledWith('-3');
  });

  it('warns about negative gaps and durations', async () => {
    const screen = await render(
      <SceneTimingFields {...timingProps()} gapInput="-2" durationInput="-5" />,
    );

    expect(screen.getByText('negative_gap_timing_hint')).toBeTruthy();
    expect(screen.getByText('negative_duration_timing_hint')).toBeTruthy();
  });

  it('changes the gap and duration units', async () => {
    const props = timingProps();
    const screen = await render(<SceneTimingFields {...props} />);

    const gapType = screen.getByTestId('single-select-gap_type_placeholder');
    expect(gapType.props.options).toHaveLength(9);
    await act(async () => {
      gapType.props.onValueChange('days');
    });
    expect(props.onGapTypeChange).toHaveBeenCalledWith('days');

    await act(async () => {
      screen.getByTestId('single-select-duration_type_placeholder').props.onValueChange('hours');
    });
    expect(props.onDurationTypeChange).toHaveBeenCalledWith('hours');
  });

  it('shows the fixed-date calendar only once a date is typed', async () => {
    const props = timingProps();
    const screen = await render(<SceneTimingFields {...props} />);

    expect(screen.queryByTestId('single-select-scene_fixed_date_calendar')).toBeNull();

    await act(async () => {
      screen.getByTestId('input-scene_fixed_date_placeholder').props.onChangeText('Day 12');
    });
    expect(props.onCalendarDateOverrideChange).toHaveBeenCalledWith('Day 12');

    await screen.rerender(<SceneTimingFields {...props} calendarDateOverride="Day 12" />);
    const calendar = screen.getByTestId('single-select-scene_fixed_date_calendar');
    expect(calendar.props.options).toEqual([
      { label: 'calendar_standard_title', value: '__gregorian__' },
      { label: 'Custom', value: 'cal-1' },
    ]);
    expect(calendar.props.value).toBe('__gregorian__');

    await act(async () => {
      calendar.props.onValueChange('__gregorian__');
    });
    expect(props.onCalendarDateOverrideCalendarIdChange).toHaveBeenCalledWith(null);

    await act(async () => {
      screen.getByTestId('single-select-scene_fixed_date_calendar').props.onValueChange('cal-1');
    });
    expect(props.onCalendarDateOverrideCalendarIdChange).toHaveBeenCalledWith('cal-1');
  });
});

describe('RelatedScenesList', () => {
  const scenes = () => [
    scene({ id: 's-b', name: 'Beta' }),
    scene({ id: 's-a', name: 'Alpha' }),
    scene({ id: 's-gone', name: 'Gone', isDeleted: true }),
    scene({ id: 's-other', name: 'Other', chapterId: 'ch-2' }),
  ];

  it('lists the matching live scenes, sorted by name', async () => {
    const screen = await render(
      <RelatedScenesList
        scenes={scenes()}
        matchesScene={(candidate) => candidate.chapterId === 'ch-1'}
        title="Scenes"
        noItemsMessage="no_scenes_here"
      />,
    );

    expect(screen.getByText('Scenes')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.queryByText('Gone')).toBeNull();
    expect(screen.queryByText('Other')).toBeNull();
    expect(screen.queryByText('no_scenes_here')).toBeNull();
  });

  it('shows the empty message when nothing matches', async () => {
    const screen = await render(
      <RelatedScenesList
        scenes={scenes()}
        matchesScene={() => false}
        title="Scenes"
        noItemsMessage="no_scenes_here"
      />,
    );

    expect(screen.getByText('no_scenes_here')).toBeTruthy();
  });

  it('situates each scene in its chapter, unless asked not to', async () => {
    const shown = await render(
      <RelatedScenesList
        scenes={scenes()}
        matchesScene={(candidate) => candidate.id === 's-a'}
        title="Scenes"
        noItemsMessage="no_scenes_here"
      />,
    );
    expect(shown.getByText('Chapter:')).toBeTruthy();
    expect(shown.getByText('Chapter One')).toBeTruthy();

    const hidden = await render(
      <RelatedScenesList
        scenes={scenes()}
        matchesScene={(candidate) => candidate.id === 's-a'}
        title="Scenes"
        noItemsMessage="no_scenes_here"
        showChapter={false}
      />,
    );
    expect(hidden.queryByText('Chapter One')).toBeNull();
  });

  it('renders the caller details and honors its ordering', async () => {
    const screen = await render(
      <RelatedScenesList
        scenes={scenes()}
        matchesScene={(candidate) => candidate.chapterId === 'ch-1'}
        title="Scenes"
        noItemsMessage="no_scenes_here"
        getDetails={(candidate) => [{ label: 'Index', value: String(candidate.index) }]}
        sortScenes={(a, b) => b.name.localeCompare(a.name)}
      />,
    );

    expect(screen.getAllByText('Index:')).toHaveLength(2);
  });

  it('opens the tapped scene', async () => {
    const screen = await render(
      <RelatedScenesList
        scenes={scenes()}
        matchesScene={(candidate) => candidate.id === 's-a'}
        title="Scenes"
        noItemsMessage="no_scenes_here"
      />,
    );

    // The section starts collapsed, which disables its rows; expand it first like a reader would.
    await fireEvent.press(screen.getByText('Scenes'));
    await fireEvent.press(screen.getByText('Alpha'));

    expect(mockNavigate).toHaveBeenCalledWith('Scene', 's-a');
  });
});

describe('groupScenePresenceEntries', () => {
  it('groups scenes by item, deduplicated and sorted', () => {
    const entries = groupScenePresenceEntries([
      { item: { id: 'b', name: 'Beta' }, scene: scene({ id: 's-2', name: 'Zulu' }) },
      { item: { id: 'a', name: 'Alpha' }, scene: scene({ id: 's-1', name: 'Mike' }) },
      { item: { id: 'b', name: 'Beta' }, scene: scene({ id: 's-0', name: 'Alpha scene' }) },
      { item: { id: 'b', name: 'Beta' }, scene: scene({ id: 's-2', name: 'Zulu' }) },
    ]);

    expect(entries.map((entry) => entry.item.id)).toEqual(['a', 'b']);
    expect(entries[1].scenes.map((entry) => entry.id)).toEqual(['s-0', 's-2']);
  });
});

describe('ScenePresenceList', () => {
  const entries = () => [
    {
      item: { id: 'c-1', name: 'Alice' },
      scenes: [scene({ name: 'First' }), scene({ id: 's-2', name: 'Second', chapterId: 'ch-2' })],
    },
  ];

  it('lists each entity with the scenes it appears in', async () => {
    const screen = await render(
      <ScenePresenceList
        entries={entries()}
        title="Appearances"
        noItemsMessage="none_here"
        entityType="Character"
        sceneLabel="Scene"
      />,
    );

    expect(screen.getByText('Appearances')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('First (Chapter One)')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('shows the empty message when nobody appears anywhere', async () => {
    const screen = await render(
      <ScenePresenceList
        entries={[]}
        title="Appearances"
        noItemsMessage="none_here"
        entityType="Character"
        sceneLabel="Scene"
      />,
    );

    expect(screen.getByText('none_here')).toBeTruthy();
  });

  it('opens the tapped entity', async () => {
    const screen = await render(
      <ScenePresenceList
        entries={entries()}
        title="Appearances"
        noItemsMessage="none_here"
        entityType="Item"
        sceneLabel="Scene"
      />,
    );

    // The section starts collapsed, which disables its rows; expand it first like a reader would.
    await fireEvent.press(screen.getByText('Appearances'));
    await fireEvent.press(screen.getByText('Alice'));

    expect(mockNavigate).toHaveBeenCalledWith('Item', 'c-1');
  });
});

describe('SceneReorderModal', () => {
  const modalProps = () => ({
    isVisible: true,
    onClose: jest.fn(),
    storyId: 'story-1',
    scenes: [
      scene({ id: 's-1', name: 'First', index: 1 }),
      scene({ id: 's-0', name: 'Zero', index: 0 }),
      scene({ id: 's-x', name: 'Elsewhere', chapterId: 'ch-2', index: 0 }),
    ],
    onReorderConfirm: jest.fn().mockResolvedValue(undefined),
    initialChapterId: null as string | null | undefined,
  });

  it('waits for a chapter before listing anything', async () => {
    const screen = await render(<SceneReorderModal {...modalProps()} />);

    expect(mockReorderProps.current?.title).toBe('reorder_scenes_title');
    expect(mockReorderProps.current?.items).toEqual([]);
    expect(mockReorderProps.current?.confirmDisabled).toBe(true);
    expect(screen.getByTestId('single-select-select_chapter_to_reorder')).toBeTruthy();
  });

  it('lists the chosen chapter scenes in index order', async () => {
    const screen = await render(<SceneReorderModal {...modalProps()} />);

    await act(async () => {
      screen.getByTestId('single-select-select_chapter_to_reorder').props.onValueChange('ch-1');
    });

    const items = mockReorderProps.current?.items as SceneSelect[];
    expect(items.map((item) => item.id)).toEqual(['s-0', 's-1']);
    expect(mockReorderProps.current?.confirmDisabled).toBe(false);
    expect(mockReorderProps.current?.getId(items[0])).toBe('s-0');
    expect(mockReorderProps.current?.getLabel(items[0])).toBe('Zero');
  });

  it('confirms the new order for the chosen chapter', async () => {
    const props = modalProps();
    const screen = await render(<SceneReorderModal {...props} />);
    await act(async () => {
      screen.getByTestId('single-select-select_chapter_to_reorder').props.onValueChange('ch-1');
    });

    const reordered = [...(mockReorderProps.current?.items as SceneSelect[])].reverse();
    await act(async () => {
      await mockReorderProps.current?.onReorderConfirm(reordered);
    });

    expect(props.onReorderConfirm).toHaveBeenCalledWith(
      'ch-1',
      buildReorderItems(reordered, (item) => item.id),
    );
  });

  it('locks the chapter it is opened with', async () => {
    const screen = await render(<SceneReorderModal {...modalProps()} initialChapterId="ch-2" />);

    expect(screen.queryByTestId('single-select-select_chapter_to_reorder')).toBeNull();
    expect((mockReorderProps.current?.items as SceneSelect[]).map((item) => item.id)).toEqual([
      's-x',
    ]);
  });

  it('says so when the chapter has no scenes', async () => {
    const props = modalProps();
    const screen = await render(<SceneReorderModal {...props} />);
    await act(async () => {
      screen.getByTestId('single-select-select_chapter_to_reorder').props.onValueChange('ch-2');
    });

    // The stubbed modal only receives the empty view; it is rendered here to read it.
    const empty = await render(
      <>{mockReorderProps.current?.emptyListComponent as React.ReactElement}</>,
    );
    expect(empty.getByText('no_scenes_in_chapter')).toBeTruthy();
  });

  it('asks for a chapter before showing scenes', async () => {
    const screen = await render(<SceneReorderModal {...modalProps()} />);
    void screen;

    const empty = await render(
      <>{mockReorderProps.current?.emptyListComponent as React.ReactElement}</>,
    );
    expect(empty.getByText('select_chapter_to_view_scenes')).toBeTruthy();
  });

  it('resyncs the chapter every time it opens', async () => {
    const props = modalProps();
    const screen = await render(<SceneReorderModal {...props} initialChapterId="ch-1" />);
    expect((mockReorderProps.current?.items as SceneSelect[]).map((item) => item.id)).toEqual([
      's-0',
      's-1',
    ]);

    await screen.rerender(<SceneReorderModal {...props} isVisible={false} />);
    await screen.rerender(<SceneReorderModal {...props} isVisible initialChapterId="ch-2" />);
    expect((mockReorderProps.current?.items as SceneSelect[]).map((item) => item.id)).toEqual([
      's-x',
    ]);
  });
});

describe('SceneNavigationControls', () => {
  const choice = (overrides = {}) => ({
    id: 'choice-1',
    storyId: 'story-1',
    sceneId: 'scene-0',
    text: 'Go left',
    nextSceneId: 'scene-2',
    ...overrides,
  });

  it('moves linearly between the previous and next scenes', async () => {
    const screen = await render(
      <SceneNavigationControls
        storyType="linear"
        previousScene={scene({ id: 'scene-0', name: 'Before' })}
        nextScene={scene({ id: 'scene-2', name: 'After' })}
        choicesForScene={[]}
      />,
    );

    expect(screen.getByText('scene_navigation')).toBeTruthy();
    await fireEvent.press(screen.getByText('Before').parent!);
    expect(mockNavNavigate).toHaveBeenCalledWith('SceneDetail', { sceneId: 'scene-0' });
    await fireEvent.press(screen.getByText('After').parent!);
    expect(mockNavNavigate).toHaveBeenCalledWith('SceneDetail', { sceneId: 'scene-2' });
  });

  it('disables the missing ends of a linear story', async () => {
    const screen = await render(
      <SceneNavigationControls storyType="linear" choicesForScene={[]} />,
    );

    expect(screen.getByText('previous_scene')).toBeTruthy();
    expect(screen.getByText('next_scene')).toBeTruthy();
    await fireEvent.press(screen.getByText('previous_scene'));
    await fireEvent.press(screen.getByText('next_scene'));
    expect(mockNavNavigate).not.toHaveBeenCalled();
  });

  it('follows outgoing choices and opens their details', async () => {
    const screen = await render(
      <SceneNavigationControls
        storyType="branching"
        choicesForScene={[choice() as any]}
        sceneNamesById={{ 'scene-2': 'The fork' }}
      />,
    );

    expect(screen.getByText('story_map_outgoing_choices')).toBeTruthy();
    expect(screen.getByText('Go left')).toBeTruthy();
    expect(screen.getByText('The fork')).toBeTruthy();

    await fireEvent.press(screen.getByText('Go left').parent!.parent!);
    expect(mockNavNavigate).toHaveBeenCalledWith('SceneDetail', { sceneId: 'scene-2' });

    await fireEvent.press(screen.getByText('view_choice_details').parent!);
    expect(mockNavigate).toHaveBeenCalledWith('Choice', 'choice-1');
  });

  it('names unknown choice targets as not available', async () => {
    const screen = await render(
      <SceneNavigationControls
        storyType="branching"
        choicesForScene={[choice() as any]}
        sceneNamesById={{}}
      />,
    );

    expect(screen.getByText('common_na')).toBeTruthy();
  });

  it('follows incoming choices back to their origin', async () => {
    const screen = await render(
      <SceneNavigationControls
        storyType="branching"
        choicesForScene={[]}
        incomingChoicesForScene={[choice() as any]}
        sceneNamesById={{ 'scene-0': 'The start' }}
      />,
    );

    expect(screen.getByText('story_map_incoming_choices')).toBeTruthy();
    await fireEvent.press(screen.getByText('Go left').parent!.parent!);
    expect(mockNavNavigate).toHaveBeenCalledWith('SceneDetail', { sceneId: 'scene-0' });
  });

  it('offers to add a choice when editable', async () => {
    const onAddChoice = jest.fn();
    const withChoices = await render(
      <SceneNavigationControls
        storyType="branching"
        choicesForScene={[choice() as any]}
        canEdit
        onAddChoice={onAddChoice}
      />,
    );
    await fireEvent.press(withChoices.getByText('add_choice').parent!);
    expect(onAddChoice).toHaveBeenCalledTimes(1);

    const withoutChoices = await render(
      <SceneNavigationControls
        storyType="branching"
        choicesForScene={[]}
        canEdit
        onAddChoice={onAddChoice}
      />,
    );
    await fireEvent.press(withoutChoices.getByText('add_choice').parent!);
    expect(onAddChoice).toHaveBeenCalledTimes(2);
  });

  it('renders nothing when there is nowhere to go', async () => {
    const noChoices = await render(
      <SceneNavigationControls storyType="branching" choicesForScene={[]} />,
    );
    expect(noChoices.toJSON()).toBeNull();

    const noType = await render(
      <SceneNavigationControls storyType={undefined} choicesForScene={[]} />,
    );
    expect(noType.toJSON()).toBeNull();
  });
});
