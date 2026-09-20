import { cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import type { CharacterScene } from '@keres/shared/entities/CharacterScene';
import type { Note, NoteRelation } from '@keres/shared/entities/Note';
import type { ThemeColors } from '@keres/shared/theme/ThemeColors';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import type { CommentableDetailFieldProps } from '../../../../src/components/features/comments/CommentableDetailField/CommentableDetailField';
import { SceneDetailContent } from '../../../../src/screens/narrative-elements/scenes/SceneDetailContent';
import type {
  CharacterSelect,
  ChoiceSelect,
  ItemJourneySelect,
  ItemSelect,
  SceneSelect,
  TagSelect,
} from '../../../../src/db/schema';
import type { SaveNoteRelation } from '../../../../src/services/storymanagement/NoteRelationService';

jest.mock('../../../../src/theme', () => {
  const actual = jest.requireActual('../../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({
      isDarkMode: false,
      colors: { primary: '#0000ff', text: '#111111', textSecondary: '#555555' },
    }),
  };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('../../../../src/components/common/controls/Button/Button', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onPress, children }: { onPress: () => void; children?: ReactNode }) => (
      <Text testID="go-back-btn" onPress={onPress}>
        {children}
      </Text>
    ),
  };
});

jest.mock('../../../../src/components/layout/DetailContainer/DetailContainer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      footer,
      children,
    }: {
      title: string;
      footer?: ReactNode;
      children?: ReactNode;
    }) => (
      <>
        <Text testID="detail-title">{title}</Text>
        {children}
        {footer}
      </>
    ),
  };
});

jest.mock('../../../../src/components/layout/ScreenSection/ScreenSection', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, children }: { title: string; children?: ReactNode }) => (
      <>
        <Text testID={`section-${title}`}>{title}</Text>
        {children}
      </>
    ),
  };
});

jest.mock(
  '../../../../src/components/features/comments/CommentableDetailField/CommentableDetailField',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: ({ label, value }: { label: string; value: string }) => (
        <Text testID={`commentable-${label}`}>{`${label}:${value}`}</Text>
      ),
    };
  },
);

jest.mock(
  '../../../../src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: ({ entityId }: { entityId: string }) => (
        <Text testID="custom-attrs">{entityId}</Text>
      ),
    };
  },
);

jest.mock(
  '../../../../src/components/features/characters/CharacterManager/SceneCharacterManager',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: (props: {
        characterRelations: unknown[];
        availableCharacters: CharacterSelect[];
        currentStoryId: string;
        currentSceneId: string;
      }) => (
        <Text testID="scene-characters">
          {JSON.stringify({
            relations: props.characterRelations.length,
            names: props.availableCharacters.map((c) => c.name),
            storyId: props.currentStoryId,
            sceneId: props.currentSceneId,
          })}
        </Text>
      ),
    };
  },
);

jest.mock('../../../../src/components/features/gallery/GalleryManager/EntityGalleryManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      ownerId: string;
      ownerType: string;
      editable: boolean;
      onPressMedia: (galleryId: string) => void;
    }) => (
      <>
        <Text testID="gallery-marker">{`${props.ownerType}:${props.ownerId}`}</Text>
        <Text testID="gallery-media" onPress={() => props.onPressMedia('gallery-9')}>
          {props.editable ? 'editable' : 'readonly'}
        </Text>
      </>
    ),
  };
});

jest.mock('../../../../src/components/features/mentions/EntityMetadataWithBacklinks', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="entity-metadata">metadata</Text>,
  };
});

jest.mock('../../../../src/components/features/items/ItemManager/ItemSceneManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      itemJourneys: unknown[];
      allItems: ItemSelect[];
      allCharacters: CharacterSelect[];
    }) => (
      <Text testID="item-scenes">
        {JSON.stringify({
          journeys: props.itemJourneys.length,
          items: props.allItems.map((i) => i.name),
          characters: props.allCharacters.map((c) => c.name),
        })}
      </Text>
    ),
  };
});

jest.mock('../../../../src/components/features/notes/NoteManager/NoteRelationManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: { noteRelations: unknown[]; availableNotes: unknown[] }) => (
      <Text testID="note-relations">
        {JSON.stringify({
          relations: props.noteRelations.length,
          notes: props.availableNotes.length,
        })}
      </Text>
    ),
  };
});

jest.mock(
  '../../../../src/components/features/scenes/SceneNavigationControls/SceneNavigationControls',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: (props: {
        storyType?: string;
        previousScene?: SceneSelect;
        nextScene?: SceneSelect;
        choicesForScene: ChoiceSelect[];
        incomingChoicesForScene: ChoiceSelect[];
        onAddChoice: () => void;
      }) => (
        <>
          <Text testID="nav-controls">
            {JSON.stringify({
              storyType: props.storyType ?? null,
              prev: props.previousScene?.id ?? null,
              next: props.nextScene?.id ?? null,
              choices: props.choicesForScene.length,
              incoming: props.incomingChoicesForScene.length,
            })}
          </Text>
          <Text testID="nav-controls-add" onPress={props.onAddChoice}>
            add
          </Text>
        </>
      ),
    };
  },
);

jest.mock('../../../../src/components/features/seealso/SeeAlsoManager/SeeAlsoManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="seealso-marker">seealso</Text>,
  };
});

jest.mock('../../../../src/components/features/favorites/FavoritedByList/FavoritedByList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="favorited-marker">favorited</Text>,
  };
});

const t = ((key: string) => key) as unknown as TFunction;

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeScene(overrides: Partial<SceneSelect> = {}): SceneSelect {
  return {
    id: 'scene-1',
    storyId: 'story-1',
    chapterId: 'chapter-1',
    locationId: null,
    name: 'Opening',
    index: 0,
    summary: 'It begins',
    body: null,
    gap: null,
    gapType: null,
    calendarDateOverride: null,
    calendarDateOverrideCalendarId: null,
    duration: null,
    durationType: null,
    isStart: false,
    isFinish: false,
    isFavorite: false,
    extraNotes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeCharacter(name: string, isDeleted = false): CharacterSelect {
  return {
    id: `char-${name}`,
    storyId: 'story-1',
    name,
    title: null,
    gender: null,
    race: null,
    subrace: null,
    description: null,
    personality: null,
    motivation: null,
    qualities: null,
    weaknesses: null,
    biography: null,
    plannedTimeline: null,
    isFavorite: false,
    extraNotes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted,
    deletedAt: null,
  };
}

function makeItem(name: string, isDeleted = false): ItemSelect {
  return {
    id: `item-${name}`,
    storyId: 'story-1',
    characterOwnerId: null,
    name,
    category: null,
    description: null,
    initialState: null,
    isFavorite: false,
    extraNotes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted,
    deletedAt: null,
  };
}

function makeChoice(id: string): ChoiceSelect {
  return {
    id,
    storyId: 'story-1',
    sceneId: 'scene-1',
    nextSceneId: 'scene-2',
    text: `choice ${id}`,
    notes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  };
}

function commentField(_field: string, value: string): Omit<CommentableDetailFieldProps, 'label'> {
  return {
    storyId: 'story-1',
    value,
    comments: [],
    canComment: false,
    isStoryOwner: false,
    currentUserId: null,
    onAddComment: async () => {},
    onDeleteComment: async () => {},
    onUpdateComment: async () => {},
  };
}

function baseProps(overrides = {}) {
  return {
    scene: makeScene(),
    navigation: { goBack: jest.fn(), navigate: jest.fn() },
    t,
    styles: {},
    selectedStory: { id: 'story-1', type: 'linear', normalizeSceneTiming: false },
    chapter: { name: 'Arrival', index: 2 },
    sceneTags: [] as TagSelect[],
    commentField,
    dateForScene: () => null,
    calendar: {},
    locationCopy: { entity: 'location_entity' },
    location: null,
    handleLocationPress: jest.fn(),
    colors: { textSecondary: '#555555' } as unknown as ThemeColors,
    openGalleryMediaViewer: jest.fn(),
    canEdit: false,
    characterSceneRelations: [] as CharacterScene[],
    characters: [] as CharacterSelect[],
    itemJourneys: [] as ItemJourneySelect[],
    allItems: [] as ItemSelect[],
    sceneNoteRelations: [] as NoteRelation[],
    allNotes: [] as Note[],
    saveNoteRelation: jest.fn(async (_r: SaveNoteRelation) => {}),
    deleteNoteRelation: jest.fn(async (_id: string) => {}),
    sceneId: 'scene-1',
    previousScene: null,
    nextScene: null,
    choicesForScene: [] as ChoiceSelect[],
    incomingChoicesForScene: [] as ChoiceSelect[],
    sceneNamesById: {},
    isBranching: false,
    sceneEffects: [] as unknown[],
    describeEffect: () => 'effect',
    ...overrides,
  };
}

function jsonOf(view: RenderResult, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

describe('SceneDetailContent', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the title, tags fallback and chapter numbering for linear stories', async () => {
    const view = await render(<SceneDetailContent {...baseProps()} />);
    expect(view.getByTestId('detail-title').props.children).toBe('Opening');
    expect(view.getByText('no_tags_found')).toBeTruthy();
    expect(view.getByText(/2\. /)).toBeTruthy();
    expect(view.getByText(/Arrival/)).toBeTruthy();
    expect(view.getByTestId('custom-attrs').props.children).toBe('scene-1');
    expect(view.getByTestId('entity-metadata')).toBeTruthy();
    expect(view.getByTestId('seealso-marker')).toBeTruthy();
    expect(view.getByTestId('favorited-marker')).toBeTruthy();
  });

  it('omits the chapter number for non-linear stories', async () => {
    const view = await render(
      <SceneDetailContent
        {...baseProps({ selectedStory: { id: 'story-1', type: 'branching' } })}
      />,
    );
    expect(view.getByText('Arrival')).toBeTruthy();
    expect(view.queryByText(/2\. /)).toBeNull();
  });

  it('shows the unchaptered label without a chapter or chapter id', async () => {
    const view = await render(
      <SceneDetailContent
        {...baseProps({ chapter: null, scene: makeScene({ chapterId: null }) })}
      />,
    );
    expect(view.getByText('unchaptered_scenes')).toBeTruthy();
  });

  it('renders no subtitle when chaptered by id only', async () => {
    const view = await render(
      <SceneDetailContent
        {...baseProps({ chapter: null, scene: makeScene({ chapterId: 'chapter-9' }) })}
      />,
    );
    expect(view.queryByText('unchaptered_scenes')).toBeNull();
    expect(view.queryByText('Arrival')).toBeNull();
  });

  it('renders the calendar date with range and duration suffixes', async () => {
    const view = await render(
      <SceneDetailContent
        {...baseProps({
          dateForScene: () => ({ date: 'Day 3', gapRange: 'GR', durationEnd: 'DE' }),
        })}
      />,
    );
    expect(view.getByText('Day 3')).toBeTruthy();
    expect(view.getByText(/· GR/)).toBeTruthy();
    expect(view.getByText(/· DE/)).toBeTruthy();
  });

  it('skips the calendar field without a date', async () => {
    const view = await render(<SceneDetailContent {...baseProps()} />);
    expect(view.queryByText('calendar_scene_date')).toBeNull();
    expect(view.getByText('gap')).toBeTruthy();
    expect(view.getByText('in_universe_duration')).toBeTruthy();
  });

  it('renders favorite state with commentable fallbacks', async () => {
    const view = await render(
      <SceneDetailContent
        {...baseProps({ scene: makeScene({ summary: null, isFavorite: true }) })}
      />,
    );
    expect(view.getByText('common_yes')).toBeTruthy();
    expect(view.getByTestId('commentable-summary').props.children).toBe('summary:common_na');
    expect(view.getByTestId('commentable-extra_notes').props.children).toBe(
      'extra_notes:common_na',
    );
  });

  it('opens the location and navigates back', async () => {
    const location = { id: 'loc-1', name: 'Harbor', description: null };
    const props = baseProps({ location });
    const view = await render(<SceneDetailContent {...props} />);
    expect(view.getByText('Harbor')).toBeTruthy();
    expect(view.getByText('common_na')).toBeTruthy();
    await fireEvent.press(view.getByText('Harbor'));
    expect(props.handleLocationPress).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByTestId('go-back-btn'));
    expect(props.navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('hides the location section without a location', async () => {
    const view = await render(<SceneDetailContent {...baseProps()} />);
    expect(view.queryByTestId('section-location_entity')).toBeNull();
  });

  it('passes filtered entities to the managers and wires actions', async () => {
    const props = baseProps({
      characters: [makeCharacter('Lyra'), makeCharacter('Ghost', true)],
      allItems: [makeItem('Sword'), makeItem('Rust', true)],
      characterSceneRelations: [{ id: 'rel-1' } as unknown as CharacterScene],
      previousScene: makeScene({ id: 'scene-0', name: 'Before' }),
      nextScene: makeScene({ id: 'scene-2', name: 'After' }),
      choicesForScene: [makeChoice('c1'), makeChoice('c2')],
      incomingChoicesForScene: [makeChoice('c0')],
      canEdit: true,
    });
    const view = await render(<SceneDetailContent {...props} />);
    expect(jsonOf(view, 'scene-characters')).toMatchObject({
      relations: 1,
      names: ['Lyra'],
      storyId: 'story-1',
      sceneId: 'scene-1',
    });
    expect(jsonOf(view, 'item-scenes')).toMatchObject({
      items: ['Sword'],
      characters: ['Lyra'],
    });
    expect(view.getByTestId('gallery-marker').props.children).toBe('Scene:scene-1');
    await fireEvent.press(view.getByTestId('gallery-media'));
    expect(props.openGalleryMediaViewer).toHaveBeenCalledWith('gallery-9');
    expect(jsonOf(view, 'nav-controls')).toMatchObject({
      storyType: 'linear',
      prev: 'scene-0',
      next: 'scene-2',
      choices: 2,
      incoming: 1,
    });
    await fireEvent.press(view.getByTestId('nav-controls-add'));
    expect(props.navigation.navigate).toHaveBeenCalledWith('ChoiceForm', {
      sceneId: 'scene-1',
    });
  });

  it('leaves the story type undefined for unknown story kinds', async () => {
    const view = await render(
      <SceneDetailContent {...baseProps({ selectedStory: { id: 'story-1', type: 'weird' } })} />,
    );
    expect(jsonOf(view, 'nav-controls').storyType).toBeNull();
  });

  it('renders effects only for branching stories', async () => {
    const flat = await render(<SceneDetailContent {...baseProps()} />);
    expect(flat.queryByText('effects_title')).toBeNull();
    const empty = await render(<SceneDetailContent {...baseProps({ isBranching: true })} />);
    expect(empty.getByText('no_effects')).toBeTruthy();
    const full = await render(
      <SceneDetailContent {...baseProps({ isBranching: true, sceneEffects: [{ id: 'e1' }] })} />,
    );
    expect(full.getByText('• effect')).toBeTruthy();
  });
});
