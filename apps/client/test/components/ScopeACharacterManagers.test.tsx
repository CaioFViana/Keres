import { render } from '@testing-library/react-native';
import type { Character } from '@keres/shared/entities/Character';
import type { CharacterScene } from '@keres/shared/entities/CharacterScene';
import React from 'react';
import type { SceneSelect } from '../../src/db/schema';
import CharacterSceneManager from '../../src/components/features/characters/CharacterManager/CharacterSceneManager';
// Imported through the barrel so the re-export itself is covered too.
import SceneCharacterManager from '../../src/components/features/characters/CharacterManager/index';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#eee',
      primary: '#00f',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../src/vocabulary/useVocabularyEntityCopy', () => ({
  useVocabularyEntityCopy: (type: string) => ({
    entity: type,
    entities: `${type}s`,
    select: `Select ${type}`,
  }),
}));

const mockNavigateToDetail = jest.fn();
jest.mock('../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => mockNavigateToDetail,
}));

const mockChapterNameOf = jest.fn((_chapterId: string | null | undefined) => 'Chapter One');
jest.mock('../../src/hooks/useChapterNames', () => ({
  useChapterNames: () => mockChapterNameOf,
}));

const mockRelationManager = jest.fn();
jest.mock('../../src/components/features/relations/RelationManager/RelationManager', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockRelationManager(props);
    return null;
  },
}));

interface CapturedRelationProps<Item, Relation> {
  relations: Relation[];
  availableItems: Item[];
  editable: boolean;
  currentStoryId: string;
  currentEntityId: string;
  createRelationObject: (selectedId: string, storyId: string, entityId: string) => Relation;
  getRelationItemId: (relation: Relation) => string;
  getItemDisplayName: (item: Item) => string;
  getItemSearchValue: (item: Item) => string;
  filterAvailableItems: (
    item: Item,
    relations: Relation[],
    getId: (relation: Relation) => string,
  ) => boolean;
  renderRelationItemExtraContent?: (relation: Relation, items: Item[]) => React.ReactNode;
  selectItemPlaceholder: string;
  title: string;
  onItemPress?: (item: Item) => void;
  itemIcon?: string;
}

const lastProps = <Item, Relation>() =>
  mockRelationManager.mock.calls[
    mockRelationManager.mock.calls.length - 1
  ][0] as CapturedRelationProps<Item, Relation>;

const characterScene = (overrides: Partial<CharacterScene> = {}): CharacterScene =>
  ({
    id: 'rel-1',
    storyId: 'story-1',
    characterId: 'char-1',
    sceneId: 'scene-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  }) as CharacterScene;

beforeEach(() => jest.clearAllMocks());

describe('CharacterSceneManager', () => {
  const scenes = [
    { id: 'scene-1', name: 'Arrival', chapterId: 'chapter-1', isDeleted: false },
    { id: 'scene-2', name: 'Ashes', chapterId: null, isDeleted: true },
  ] as SceneSelect[];

  const renderManager = (relations: CharacterScene[] = [characterScene()]) =>
    render(
      <CharacterSceneManager
        characterSceneRelations={relations}
        availableScenes={scenes}
        onSave={jest.fn()}
        onDelete={jest.fn()}
        editable
        currentStoryId="story-1"
        currentCharacterId="char-1"
      />,
    );

  it('configures the relation list for scenes', async () => {
    await renderManager();

    const props = lastProps<SceneSelect, CharacterScene>();
    expect(props.relations).toHaveLength(1);
    expect(props.availableItems).toBe(scenes);
    expect(props.editable).toBe(true);
    expect(props.currentStoryId).toBe('story-1');
    expect(props.currentEntityId).toBe('char-1');
    expect(props.title).toBe('Scenes');
    expect(props.itemIcon).toBe('easel');
    expect(props.selectItemPlaceholder).toBe('Select Scene');
  });

  it('builds a fresh character-scene link', async () => {
    await renderManager();
    const props = lastProps<SceneSelect, CharacterScene>();

    const created = props.createRelationObject('scene-9', 'story-1', 'char-1');
    expect(created).toMatchObject({
      storyId: 'story-1',
      characterId: 'char-1',
      sceneId: 'scene-9',
      version: 1,
      isDeleted: false,
      deletedAt: null,
    });
    expect(typeof created.id).toBe('string');

    expect(props.getRelationItemId(characterScene({ sceneId: 'scene-9' }))).toBe('scene-9');
    expect(props.getItemDisplayName(scenes[0])).toBe('Arrival');
    expect(props.getItemSearchValue(scenes[0])).toBe('Arrival');
  });

  it('offers only living, unlinked scenes', async () => {
    await renderManager();
    const props = lastProps<SceneSelect, CharacterScene>();
    const relations = [characterScene({ sceneId: 'scene-1' })];

    expect(props.filterAvailableItems(scenes[0], relations, props.getRelationItemId)).toBe(false);
    expect(props.filterAvailableItems(scenes[1], [], props.getRelationItemId)).toBe(false);
    expect(
      props.filterAvailableItems(
        { ...scenes[0], id: 'scene-9' } as SceneSelect,
        relations,
        props.getRelationItemId,
      ),
    ).toBe(true);
  });

  it('renders the scene with its chapter', async () => {
    await renderManager();
    const props = lastProps<SceneSelect, CharacterScene>();

    const extra = props.renderRelationItemExtraContent?.(characterScene(), scenes);
    const view = await render(<>{extra}</>);
    expect(view.getByText('Arrival')).toBeTruthy();
    expect(view.getByText('Chapter One')).toBeTruthy();
    expect(mockChapterNameOf).toHaveBeenCalledWith('chapter-1');
  });

  it('renders nothing extra for an unknown scene', async () => {
    await renderManager();
    const props = lastProps<SceneSelect, CharacterScene>();

    expect(
      props.renderRelationItemExtraContent?.(characterScene({ sceneId: 'missing' }), scenes),
    ).toBeNull();
  });

  it('navigates to the pressed scene', async () => {
    await renderManager();
    const props = lastProps<SceneSelect, CharacterScene>();

    props.onItemPress?.(scenes[0]);
    expect(mockNavigateToDetail).toHaveBeenCalledWith('Scene', 'scene-1');
  });
});

describe('SceneCharacterManager', () => {
  const characters = [
    { id: 'char-1', name: 'Ari', title: 'Captain', isDeleted: false },
    { id: 'char-2', name: 'Bex', title: null, isDeleted: true },
  ] as Character[];

  const renderManager = (relations: CharacterScene[] = [characterScene()]) =>
    render(
      <SceneCharacterManager
        characterRelations={relations}
        availableCharacters={characters}
        onSave={jest.fn()}
        onDelete={jest.fn()}
        editable
        currentStoryId="story-1"
        currentSceneId="scene-1"
      />,
    );

  it('configures the relation list for characters', async () => {
    await renderManager();

    const props = lastProps<Character, CharacterScene>();
    expect(props.currentEntityId).toBe('scene-1');
    expect(props.title).toBe('Characters');
    expect(props.itemIcon).toBe('people');
    expect(props.selectItemPlaceholder).toBe('Select Character');
  });

  it('builds the same link from the scene side', async () => {
    await renderManager();
    const props = lastProps<Character, CharacterScene>();

    expect(props.createRelationObject('char-9', 'story-1', 'scene-1')).toMatchObject({
      storyId: 'story-1',
      characterId: 'char-9',
      sceneId: 'scene-1',
    });
    expect(props.getRelationItemId(characterScene({ characterId: 'char-9' }))).toBe('char-9');
    expect(props.getItemDisplayName(characters[0])).toBe('Ari');
  });

  it('offers only living, unlinked characters', async () => {
    await renderManager();
    const props = lastProps<Character, CharacterScene>();
    const relations = [characterScene({ characterId: 'char-1' })];

    expect(props.filterAvailableItems(characters[0], relations, props.getRelationItemId)).toBe(
      false,
    );
    expect(props.filterAvailableItems(characters[1], [], props.getRelationItemId)).toBe(false);
    expect(
      props.filterAvailableItems(
        { ...characters[0], id: 'char-9' } as Character,
        relations,
        props.getRelationItemId,
      ),
    ).toBe(true);
  });

  it('renders the character with its title line', async () => {
    await renderManager();
    const props = lastProps<Character, CharacterScene>();

    const view = await render(
      <>{props.renderRelationItemExtraContent?.(characterScene(), characters)}</>,
    );
    expect(view.getByText('Ari')).toBeTruthy();
    expect(view.getByText('Captain')).toBeTruthy();
  });

  it('omits the title line when the character has none', async () => {
    await renderManager();
    const props = lastProps<Character, CharacterScene>();
    const untitled = [{ ...characters[0], id: 'char-9', title: null }] as Character[];

    const view = await render(
      <>
        {props.renderRelationItemExtraContent?.(
          characterScene({ characterId: 'char-9' }),
          untitled,
        )}
      </>,
    );
    expect(view.getByText('Ari')).toBeTruthy();
    expect(view.queryByText('Captain')).toBeNull();
  });

  it('navigates to the pressed character', async () => {
    await renderManager();
    const props = lastProps<Character, CharacterScene>();

    props.onItemPress?.(characters[0]);
    expect(mockNavigateToDetail).toHaveBeenCalledWith('Character', 'char-1');
  });
});
