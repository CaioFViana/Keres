import { render } from '@testing-library/react-native';
import type { Character } from '@keres/shared/entities/Character';
import type { Item, ItemJourney } from '@keres/shared/entities/Item';
import type { Scene } from '@keres/shared/entities/Scene';
import React from 'react';
import type { SceneSelect } from '../../src/db/schema';
import type { CharacterSelect } from '../../src/db/schemas/characters';
import ItemCharacterManager from '../../src/components/features/items/ItemManager/ItemCharacterManager';
import ItemSceneManager from '../../src/components/features/items/ItemManager/ItemSceneManager';
import LocationItemManager from '../../src/components/features/locations/LocationManager/LocationItemManager';

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
  useVocabularyEntityCopy: (type: string) => ({ entity: type, entities: `${type}s` }),
}));

const mockNavigateToDetail = jest.fn();
jest.mock('../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => mockNavigateToDetail,
}));

const mockRelationDisplay = jest.fn();
jest.mock('../../src/components/features/relations/RelationManager/GenericRelationDisplay', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockRelationDisplay(props);
    return null;
  },
}));

interface CapturedDisplay<ItemT, RelationT> {
  relations: RelationT[];
  getRelatedItem: (itemId: string) => ItemT | undefined;
  getRelationItemId: (relation: RelationT) => string;
  getItemDisplayName: (item: ItemT) => string;
  noItemsMessage: string;
  renderItemExtraContent?: (relation: RelationT, relatedItem: ItemT) => React.ReactNode;
  title: string;
  onItemPress?: (item: ItemT) => void;
  icon?: string;
}

const lastProps = <ItemT, RelationT>() =>
  mockRelationDisplay.mock.calls[mockRelationDisplay.mock.calls.length - 1][0] as CapturedDisplay<
    ItemT,
    RelationT
  >;

const item = (overrides: Partial<Item> = {}): Item =>
  ({
    id: 'item-1',
    name: 'Sword',
    characterOwnerId: null,
    initialState: 'Sheathed',
    extraNotes: null,
    isDeleted: false,
    ...overrides,
  }) as Item;

const itemJourney = (overrides: Partial<ItemJourney> = {}): ItemJourney =>
  ({
    id: 'journey-1',
    itemId: 'item-1',
    sceneId: 'scene-1',
    newState: 'Drawn',
    newCharacterOwnerId: null,
    extraNotes: null,
    isDeleted: false,
    createdAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  }) as unknown as ItemJourney;

beforeEach(() => jest.clearAllMocks());

describe('ItemCharacterManager', () => {
  const allItems = [
    item({ id: 'item-1', characterOwnerId: 'char-1', extraNotes: 'Heirloom' }),
    item({ id: 'item-2', name: 'Shield', characterOwnerId: 'char-2' }),
    item({ id: 'item-3', name: 'Gone', characterOwnerId: 'char-1', isDeleted: true }),
  ];
  const allJourneys = [
    itemJourney({ id: 'journey-1', itemId: 'item-2', newCharacterOwnerId: 'char-1' }),
    itemJourney({ id: 'journey-2', itemId: 'item-2', newCharacterOwnerId: 'char-2' }),
  ];
  const allScenes = [{ id: 'scene-1', name: 'Arrival' }] as Scene[];

  const renderManager = () =>
    render(
      <ItemCharacterManager
        allItemJourneys={allJourneys}
        allItems={allItems}
        allScenes={allScenes}
        currentCharacterId="char-1"
      />,
    );

  it('lists owned items and received journeys', async () => {
    await renderManager();
    const props = lastProps<Item, Item | ItemJourney>();

    expect(props.title).toBe('Items');
    expect(props.noItemsMessage).toBe('no_items_assigned_to_character');
    expect(props.icon).toBe('cube');
    expect(props.relations).toHaveLength(2);
    expect(props.getItemDisplayName(allItems[0])).toBe('Sword');
    expect(props.getRelatedItem('item-1')).toBe(allItems[0]);
    expect(props.getRelationItemId(allItems[0])).toBe('item-1');
    expect(props.getRelationItemId(allJourneys[0])).toBe('item-2');
  });

  it('renders owned items with their state lines', async () => {
    await renderManager();
    const props = lastProps<Item, Item | ItemJourney>();

    const view = await render(<>{props.renderItemExtraContent?.(allItems[0], allItems[0])}</>);
    expect(view.getByText('Sword')).toBeTruthy();
    expect(view.getByText('Sheathed')).toBeTruthy();
    expect(view.getByText('Heirloom')).toBeTruthy();
  });

  it('renders received journeys with scene and state', async () => {
    await renderManager();
    const props = lastProps<Item, Item | ItemJourney>();

    const view = await render(<>{props.renderItemExtraContent?.(allJourneys[0], allItems[1])}</>);
    expect(view.getByText('Shield')).toBeTruthy();
    expect(view.getByText('Drawn')).toBeTruthy();
    expect(view.getByText('Arrival')).toBeTruthy();
  });

  it('navigates to the pressed item', async () => {
    await renderManager();
    const props = lastProps<Item, Item | ItemJourney>();

    props.onItemPress?.(allItems[0]);
    expect(mockNavigateToDetail).toHaveBeenCalledWith('Item', 'item-1');
  });
});

describe('ItemSceneManager', () => {
  const journeys = [
    itemJourney({ id: 'journey-1', newCharacterOwnerId: 'char-1', extraNotes: 'At dawn' }),
    itemJourney({ id: 'journey-2', sceneId: 'scene-2' }),
    itemJourney({ id: 'journey-3', isDeleted: true }),
  ];
  const allItems = [item()];
  const allCharacters = [{ id: 'char-1', name: 'Ari' }] as Character[];

  const renderManager = () =>
    render(
      <ItemSceneManager
        itemJourneys={journeys}
        allItems={allItems}
        allCharacters={allCharacters}
        currentSceneId="scene-1"
      />,
    );

  it('keeps only the living journeys of the scene', async () => {
    await renderManager();
    const props = lastProps<Item, ItemJourney>();

    expect(props.relations).toEqual([journeys[0]]);
    expect(props.title).toBe('Items');
    expect(props.noItemsMessage).toBe('no_items_assigned_to_scene');
    expect(props.getRelationItemId(journeys[0])).toBe('item-1');
  });

  it('renders the journey with owner and notes', async () => {
    await renderManager();
    const props = lastProps<Item, ItemJourney>();

    const view = await render(<>{props.renderItemExtraContent?.(journeys[0], allItems[0])}</>);
    expect(view.getByText('Sword')).toBeTruthy();
    expect(view.getByText('Drawn')).toBeTruthy();
    expect(view.getByText('Ari')).toBeTruthy();
    expect(view.getByText('At dawn')).toBeTruthy();
  });

  it('navigates to the pressed item', async () => {
    await renderManager();
    const props = lastProps<Item, ItemJourney>();

    props.onItemPress?.(allItems[0]);
    expect(mockNavigateToDetail).toHaveBeenCalledWith('Item', 'item-1');
  });
});

describe('LocationItemManager', () => {
  const availableScenes = [
    { id: 'scene-1', name: 'Arrival', locationId: 'loc-1', isDeleted: false },
    { id: 'scene-2', name: 'Elsewhere', locationId: 'loc-9', isDeleted: false },
    { id: 'scene-3', name: 'Gone', locationId: 'loc-1', isDeleted: true },
  ] as SceneSelect[];
  const availableItems = [
    item({ id: 'item-1', name: 'Sword' }),
    item({ id: 'item-2', name: 'Amulet' }),
  ];
  const availableJourneys = [
    itemJourney({
      id: 'journey-1',
      itemId: 'item-1',
      sceneId: 'scene-1',
      newCharacterOwnerId: 'char-1',
      createdAt: new Date('2024-01-03T00:00:00Z'),
    }),
    itemJourney({
      id: 'journey-2',
      itemId: 'item-1',
      sceneId: 'scene-2',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    }),
    itemJourney({
      id: 'journey-3',
      itemId: 'item-2',
      sceneId: 'scene-1',
      newState: 'Found',
      createdAt: new Date('2024-01-02T00:00:00Z'),
    }),
  ];
  const availableCharacters = [{ id: 'char-1', name: 'Ari' }] as CharacterSelect[];

  const renderManager = () =>
    render(
      <LocationItemManager
        currentLocationId="loc-1"
        availableItemJourneys={availableJourneys}
        availableItems={availableItems}
        availableScenes={availableScenes}
        availableCharacters={availableCharacters}
      />,
    );

  it('groups the location journeys by item, sorted by name', async () => {
    await renderManager();
    const props = lastProps<Item, { id: string; itemId: string; journeys: ItemJourney[] }>();

    expect(props.title).toBe('items_in_location_title');
    expect(props.noItemsMessage).toBe('no_items_in_location');
    // Amulet before Sword; only journeys staged in this location.
    expect(props.relations.map((relation) => relation.itemId)).toEqual(['item-2', 'item-1']);
    expect(props.relations[1].journeys.map((entry) => entry.id)).toEqual(['journey-1']);
    expect(props.getItemDisplayName(availableItems[0])).toBe('Sword');
  });

  it('renders each journey with scene, state and owner', async () => {
    await renderManager();
    const props = lastProps<Item, { id: string; itemId: string; journeys: ItemJourney[] }>();

    const view = await render(
      <>{props.renderItemExtraContent?.(props.relations[1], availableItems[0])}</>,
    );
    expect(view.getByText('Sword')).toBeTruthy();
    expect(view.getByText('Arrival')).toBeTruthy();
    expect(view.getByText('Drawn')).toBeTruthy();
    expect(view.getByText('Ari')).toBeTruthy();
  });

  it('names unknown scenes without crashing', async () => {
    await renderManager();
    const props = lastProps<Item, { id: string; itemId: string; journeys: ItemJourney[] }>();

    const view = await render(
      <>
        {props.renderItemExtraContent?.(
          {
            id: 'item-1',
            itemId: 'item-1',
            journeys: [itemJourney({ sceneId: 'ghost', newState: '' })],
          },
          availableItems[0],
        )}
      </>,
    );
    expect(view.getByText('unknown_scene')).toBeTruthy();
  });

  it('groups nothing when no scene belongs to the location', async () => {
    await render(
      <LocationItemManager
        currentLocationId="loc-1"
        availableItemJourneys={availableJourneys}
        availableItems={availableItems}
        availableScenes={[]}
        availableCharacters={[]}
      />,
    );
    const props = lastProps<Item, { id: string; itemId: string; journeys: ItemJourney[] }>();

    expect(props.relations).toHaveLength(0);
  });

  it('navigates to the pressed item', async () => {
    await renderManager();
    const props = lastProps<Item, { id: string; itemId: string; journeys: ItemJourney[] }>();

    props.onItemPress?.(availableItems[0]);
    expect(mockNavigateToDetail).toHaveBeenCalledWith('Item', 'item-1');
  });
});
