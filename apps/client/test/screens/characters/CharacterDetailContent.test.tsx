import { cleanup, fireEvent, render } from '@testing-library/react-native';
import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import type { CharacterScene } from '@keres/shared/entities/CharacterScene';
import type { Note, NoteRelation } from '@keres/shared/entities/Note';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import type { CommentableDetailFieldProps } from '../../../src/components/features/comments/CommentableDetailField/CommentableDetailField';
import { CharacterDetailContent } from '../../../src/screens/characters/CharacterDetailContent';
import type { CharacterSelect } from '../../../src/db/schemas/characters';
import type { ModeSelect } from '../../../src/db/schemas/modes';
import type {
  ItemJourneySelect,
  ItemSelect,
  SceneSelect,
  StoryArcSelect,
  TagSelect,
} from '../../../src/db/schema';
import type { StoryStatsData } from '../../../src/hooks/useStoryStats';
import type { ScenePresenceEntry } from '../../../src/components/features/scenes/ScenePresenceList/ScenePresenceList';

jest.mock('../../../src/components/common/controls/Button/Button', () => {
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

jest.mock('../../../src/components/common/display/DetailField/DetailField', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, value }: { label: string; value: string }) => (
      <Text testID={`detail-${label}`}>{`${label}:${value}`}</Text>
    ),
  };
});

jest.mock('../../../src/components/common/display/TagList/TagList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ tags, emptyMessage }: { tags: { name: string }[]; emptyMessage: string }) => (
      <Text testID="tag-list">
        {tags.length === 0 ? emptyMessage : tags.map((tag) => tag.name).join(',')}
      </Text>
    ),
  };
});

jest.mock('../../../src/components/layout/DetailContainer/DetailContainer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      footer,
      landing,
      children,
    }: {
      title: string;
      footer?: ReactNode;
      landing?: unknown;
      children?: ReactNode;
    }) => (
      <>
        <Text testID="detail-title">{title}</Text>
        <Text testID="detail-landing">{JSON.stringify(landing ?? null)}</Text>
        {children}
        {footer}
      </>
    ),
  };
});

jest.mock('../../../src/components/layout/ScreenSection/ScreenSection', () => {
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
  '../../../src/components/features/comments/CommentableDetailField/CommentableDetailField',
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
  '../../../src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields',
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

jest.mock('../../../src/components/features/gallery/GalleryManager/EntityGalleryManager', () => {
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

jest.mock('../../../src/components/features/stats/CharacterStatPanel/CharacterStatPanel', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    CharacterStatPanel: (props: {
      characterId: string;
      characterName: string;
      notation: string;
      onCompare: (modeId: string | null) => void;
    }) => (
      <>
        <Text testID="stat-panel">
          {`${props.characterId}:${props.characterName}:${props.notation}`}
        </Text>
        <Text testID="stat-panel-compare" onPress={() => props.onCompare('mode-1')}>
          compare
        </Text>
      </>
    ),
  };
});

jest.mock('../../../src/components/features/stats/ModeManager/ModeManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ModeManager: (props: { modes: unknown[]; editable: boolean }) => (
      <Text testID="mode-manager">
        {JSON.stringify({ modes: props.modes.length, editable: props.editable })}
      </Text>
    ),
  };
});

jest.mock(
  '../../../src/components/features/relations/CharacterRelationManager/CharacterRelationManager',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: (props: {
        characterRelations: unknown[];
        characters: { name: string }[];
        currentCharacterId: string;
        editable: boolean;
      }) => (
        <Text testID="relation-manager">
          {JSON.stringify({
            relations: props.characterRelations.length,
            characters: props.characters.map((c) => c.name),
            current: props.currentCharacterId,
            editable: props.editable,
          })}
        </Text>
      ),
    };
  },
);

jest.mock(
  '../../../src/components/features/characters/CharacterManager/CharacterSceneManager',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: (props: {
        characterSceneRelations: unknown[];
        availableScenes: { name: string }[];
        currentCharacterId: string;
      }) => (
        <Text testID="scene-manager">
          {JSON.stringify({
            relations: props.characterSceneRelations.length,
            scenes: props.availableScenes.map((s) => s.name),
            current: props.currentCharacterId,
          })}
        </Text>
      ),
    };
  },
);

jest.mock('../../../src/components/features/items/ItemManager/ItemCharacterManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      allItems: unknown[];
      allItemJourneys: unknown[];
      currentCharacterId: string;
    }) => (
      <Text testID="item-manager">
        {JSON.stringify({
          items: props.allItems.length,
          journeys: props.allItemJourneys.length,
          current: props.currentCharacterId,
        })}
      </Text>
    ),
  };
});

jest.mock('../../../src/components/features/scenes/ScenePresenceList/ScenePresenceList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      entries: unknown[];
      title: string;
      entityType: string;
      sceneLabel: string;
    }) => (
      <Text testID="presence-list">
        {JSON.stringify({
          entries: props.entries.length,
          title: props.title,
          entityType: props.entityType,
          sceneLabel: props.sceneLabel,
        })}
      </Text>
    ),
  };
});

jest.mock('../../../src/components/features/notes/NoteManager', () => {
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

jest.mock('../../../src/components/features/arcs/AppearsInArcsSection', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ arcs }: { arcs: unknown[] }) => (
      <Text testID="arcs-marker">{`arcs:${arcs.length}`}</Text>
    ),
  };
});

jest.mock('../../../src/components/features/seealso/SeeAlsoManager/SeeAlsoManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="seealso-marker">seealso</Text>,
  };
});

jest.mock('../../../src/components/features/favorites/FavoritedByList/FavoritedByList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="favorited-marker">favorited</Text>,
  };
});

jest.mock('../../../src/components/features/mentions/EntityMetadataWithBacklinks', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="entity-metadata">metadata</Text>,
  };
});

const t = ((key: string) => key) as unknown as TFunction;
const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeCharacter(overrides: Partial<CharacterSelect> = {}): CharacterSelect {
  return {
    id: 'char-1',
    storyId: 'story-1',
    name: 'Aria',
    title: 'Captain',
    gender: 'female',
    race: 'Elf',
    subrace: 'Wood elf',
    description: 'A scout',
    personality: 'Bold',
    motivation: 'Freedom',
    qualities: 'Quick',
    weaknesses: 'Impatient',
    biography: 'Born far away',
    plannedTimeline: 'Act one',
    isFavorite: false,
    extraNotes: 'Notes here',
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
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
    character: makeCharacter(),
    navigation: { goBack: jest.fn(), navigate: jest.fn() },
    t,
    characterTags: [] as TagSelect[],
    styles: { subTitle: {} },
    commentField,
    characterId: 'char-1',
    openGalleryMediaViewer: jest.fn(),
    canEdit: false,
    statSystemEnabled: false,
    statData: { modes: [], stats: [] } as unknown as StoryStatsData,
    selectedStory: { statNotation: 'letter' },
    characterModes: [] as ModeSelect[],
    noopModeWrite: (async () => {}) as (...args: never[]) => Promise<void>,
    characterRelations: [] as CharacterRelation[],
    allCharacters: [] as CharacterSelect[],
    handleSaveRelation: jest.fn(async () => {}),
    handleDeleteRelation: jest.fn(async () => {}),
    characterSceneRelations: [] as CharacterScene[],
    allScenes: [] as SceneSelect[],
    handleSaveCharacterScene: jest.fn(async () => {}),
    handleDeleteCharacterScene: jest.fn(async () => {}),
    allItems: [] as ItemSelect[],
    allItemJourneys: [] as ItemJourneySelect[],
    characterLocationEntries: [] as ScenePresenceEntry<{ id: string; name: string }>[],
    locationCopy: { entities: 'Locations' },
    sceneCopy: { entity: 'Scene' },
    characterNoteRelations: [] as NoteRelation[],
    allNotes: [] as Note[],
    saveNoteRelation: jest.fn(async () => {}),
    deleteNoteRelation: jest.fn(async () => {}),
    appearingArcs: [] as StoryArcSelect[],
    ...overrides,
  };
}

type View = { getByTestId: (id: string) => { props: { children?: unknown } } };

function jsonOf(view: View, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

describe('CharacterDetailContent', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the title, subtitle, tags fallback and favorite state', async () => {
    const view = await render(<CharacterDetailContent {...baseProps()} />);
    expect(view.getByTestId('detail-title').props.children).toBe('Aria');
    expect(view.getByText('Captain')).toBeTruthy();
    expect(view.getByTestId('tag-list').props.children).toBe('no_tags_found');
    expect(view.getByTestId('detail-is_favorite').props.children).toBe('is_favorite:common_no');
    expect(view.getByTestId('custom-attrs').props.children).toBe('char-1');
    expect(view.getByTestId('entity-metadata')).toBeTruthy();
    expect(view.getByTestId('seealso-marker')).toBeTruthy();
    expect(view.getByTestId('favorited-marker')).toBeTruthy();
    expect(view.getByTestId('arcs-marker').props.children).toBe('arcs:0');
  });

  it('falls back to common_na for blank fields and common_yes for favorites', async () => {
    const view = await render(
      <CharacterDetailContent
        {...baseProps({
          character: makeCharacter({
            title: null,
            gender: null,
            race: '',
            description: null,
            personality: null,
            motivation: null,
            qualities: null,
            weaknesses: null,
            biography: null,
            plannedTimeline: null,
            extraNotes: null,
            subrace: null,
            isFavorite: true,
          }),
        })}
      />,
    );
    expect(view.queryByText('Captain')).toBeNull();
    expect(view.getByTestId('commentable-gender').props.children).toBe('gender:common_na');
    expect(view.getByTestId('commentable-race').props.children).toBe('race:common_na');
    expect(view.getByTestId('commentable-description').props.children).toBe(
      'description:common_na',
    );
    expect(view.getByTestId('commentable-extra_notes').props.children).toBe(
      'extra_notes:common_na',
    );
    expect(view.queryByTestId('commentable-subrace')).toBeNull();
    expect(view.getByTestId('detail-is_favorite').props.children).toBe('is_favorite:common_yes');
  });

  it('forwards the occurrence landing to the container', async () => {
    const view = await render(
      <CharacterDetailContent
        {...baseProps({ occurrence: { field: 'biography', needle: 'harbor' } })}
      />,
    );

    expect(jsonOf(view, 'detail-landing')).toEqual({ field: 'biography', needle: 'harbor' });
  });

  it('navigates back and opens gallery media', async () => {
    const props = baseProps({ canEdit: true });
    const view = await render(<CharacterDetailContent {...props} />);
    await fireEvent.press(view.getByTestId('go-back-btn'));
    expect(props.navigation.goBack).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('gallery-marker').props.children).toBe('Character:char-1');
    expect(view.getByTestId('gallery-media').props.children).toBe('editable');
    await fireEvent.press(view.getByTestId('gallery-media'));
    expect(props.openGalleryMediaViewer).toHaveBeenCalledWith('gallery-9');
  });

  it('shows the stats panel only when the stat system is enabled', async () => {
    const disabled = await render(<CharacterDetailContent {...baseProps()} />);
    expect(disabled.queryByTestId('stat-panel')).toBeNull();
    expect(disabled.queryByTestId('section-stats_title')).toBeNull();
    expect(jsonOf(disabled, 'mode-manager')).toEqual({ modes: 0, editable: false });

    const props = baseProps({ statSystemEnabled: true });
    const enabled = await render(<CharacterDetailContent {...props} />);
    expect(enabled.getByTestId('section-stats_title')).toBeTruthy();
    expect(enabled.getByTestId('stat-panel').props.children).toBe('char-1:Aria:letter');
    await fireEvent.press(enabled.getByTestId('stat-panel-compare'));
    expect(props.navigation.navigate).toHaveBeenCalledWith('CustomizationStack', {
      screen: 'StatComparison',
      params: { characterId: 'char-1', modeId: 'mode-1' },
    });
  });

  it('wires relation, scene, item, presence and note managers', async () => {
    const view = await render(
      <CharacterDetailContent
        {...baseProps({
          allCharacters: [makeCharacter({ id: 'char-2', name: 'Bram' })],
          allScenes: [{ id: 'scene-1', name: 'Opening' }],
          characterRelations: [{ id: 'rel-1' }],
          characterSceneRelations: [{ id: 'cs-1' }],
          allItems: [{ id: 'item-1' }],
          allItemJourneys: [{ id: 'ij-1' }, { id: 'ij-2' }],
          characterLocationEntries: [{ item: { id: 'loc-1', name: 'Keep' }, scenes: [] }],
          characterNoteRelations: [{ id: 'nr-1' }],
          allNotes: [{ id: 'note-1' }, { id: 'note-2' }],
        })}
      />,
    );
    expect(jsonOf(view, 'relation-manager')).toMatchObject({
      relations: 1,
      characters: ['Bram'],
      current: 'char-1',
      editable: false,
    });
    expect(jsonOf(view, 'scene-manager')).toMatchObject({
      relations: 1,
      scenes: ['Opening'],
      current: 'char-1',
    });
    expect(jsonOf(view, 'item-manager')).toMatchObject({
      items: 1,
      journeys: 2,
      current: 'char-1',
    });
    expect(jsonOf(view, 'presence-list')).toMatchObject({
      entries: 1,
      title: 'Locations',
      entityType: 'Location',
      sceneLabel: 'Scene',
    });
    expect(jsonOf(view, 'note-relations')).toEqual({ relations: 1, notes: 2 });
  });
});
