import { act, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import ChapterListItem from '../../src/components/features/list-items/ChapterListItem';
import CharacterListItem from '../../src/components/features/list-items/CharacterListItem';
import ItemListItem from '../../src/components/features/list-items/ItemListItem';
import ListItemTitle from '../../src/components/features/list-items/ListItemTitle';
import LocationListItem from '../../src/components/features/list-items/LocationListItem';
import NoteListItem from '../../src/components/features/list-items/NoteListItem';
import PlotListItem from '../../src/components/features/list-items/PlotListItem';
import SceneListItem from '../../src/components/features/list-items/SceneListItem';
import TagListItem from '../../src/components/features/list-items/TagListItem';
import WorldRuleListItem from '../../src/components/features/list-items/WorldRuleListItem';
import type { ChapterSelect, PlotSelect, SceneSelect, TagSelect } from '../../src/db/schema';
import type { ItemSelect } from '../../src/db/schemas/items';
import type { TagSelect as TagRow } from '../../src/db/schemas/tags';
import type { WorldRuleWithTags } from '../../src/db/schemas/worldRules';
import type { CharacterWithTags } from '../../src/services/storymanagement/CharacterService';
import type { LocationWithTags } from '../../src/services/storymanagement/LocationService';
import type { NoteWithTags } from '../../src/services/storymanagement/NoteService';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
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

const mockGenericItem = jest.fn();
jest.mock(
  '../../src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions',
  () => {
    const RN = jest.requireActual('react-native');
    return {
      __esModule: true,
      default: (props: {
        item: { id: string };
        renderHeaderContent: (item: { id: string }) => React.ReactNode;
        renderExpandedContent: (item: { id: string }) => React.ReactNode;
      }) => {
        mockGenericItem(props);
        return (
          <RN.View testID="generic-item">
            {props.renderHeaderContent(props.item)}
            {props.renderExpandedContent(props.item)}
          </RN.View>
        );
      },
    };
  },
);

jest.mock('../../src/components/common/display/TagList/TagList', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ tags }: { tags: { id: string; name: string }[] }) => (
      <RN.View testID="tag-list">
        {tags.map((tag) => (
          <RN.Text key={tag.id}>{tag.name}</RN.Text>
        ))}
      </RN.View>
    ),
  };
});

interface CapturedItem<T> {
  item: T;
  onToggleFavorite?: (id: string, isFavorite: boolean) => void;
  onViewDetails?: (id: string) => void;
  entityType?: string;
  entityAppearance?: { color: string; icon: string };
  initialExpanded?: boolean;
  density?: string;
  isExpanded?: boolean;
  accessibilityLabel?: string;
}

const lastProps = <T,>() =>
  mockGenericItem.mock.calls[mockGenericItem.mock.calls.length - 1][0] as CapturedItem<T>;

beforeEach(() => jest.clearAllMocks());

describe('ListItemTitle', () => {
  it('renders the title on one ellipsized line', async () => {
    const view = await render(
      <ListItemTitle
        text="1. Arrival"
        headerLeftStyle={{ flex: 1 }}
        nameStyle={{ color: '#111' }}
      />,
    );

    const title = view.getByText('1. Arrival');
    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.ellipsizeMode).toBe('tail');
  });
});

describe('ChapterListItem', () => {
  const chapter = (overrides: Partial<ChapterSelect> = {}): ChapterSelect =>
    ({
      id: 'chapter-1',
      name: 'Prologue',
      index: 1,
      type: 'chapter',
      summary: 'It begins',
      extraNotes: 'Slow start',
      ...overrides,
    }) as ChapterSelect;

  it('numbers chapters and shows their preview', async () => {
    const tags = [{ id: 'tag-1', name: 'Canon' }] as TagSelect[];
    const view = await render(
      <ChapterListItem
        chapter={chapter()}
        onToggleFavorite={jest.fn()}
        onViewDetails={jest.fn()}
        tags={tags}
      />,
    );

    expect(view.getByText('1. Prologue')).toBeTruthy();
    expect(view.getByText('It begins')).toBeTruthy();
    expect(view.getByText('Slow start')).toBeTruthy();
    expect(view.getByText('Canon')).toBeTruthy();
    const props = lastProps<ChapterSelect>();
    expect(props.entityType).toBe('Chapter');
    expect(props.accessibilityLabel).toBe('1. Prologue');
  });

  it('marks events with an hourglass instead of a number', async () => {
    const view = await render(
      <ChapterListItem
        chapter={chapter({ id: 'event-1', name: 'Festival', type: 'event' })}
        onToggleFavorite={jest.fn()}
        onViewDetails={jest.fn()}
      />,
    );

    expect(view.getByTestId('event-marker-event-1')).toBeTruthy();
    expect(view.getByText('Festival')).toBeTruthy();
    expect(lastProps<ChapterSelect>().entityType).toBe('Event');
  });

  it('renders the unchaptered group without actions', async () => {
    const view = await render(
      <ChapterListItem
        chapter={chapter({ id: '__unchaptered__', name: 'Loose scenes' })}
        onToggleFavorite={jest.fn()}
        onViewDetails={jest.fn()}
      />,
    );

    expect(view.getByText('Loose scenes')).toBeTruthy();
    const props = lastProps<ChapterSelect>();
    expect(props.onToggleFavorite).toBeUndefined();
    expect(props.onViewDetails).toBeUndefined();
    expect(props.entityType).toBeUndefined();
  });

  it('tracks expanded scenes for the embedded list', async () => {
    const renderScenes = jest.fn(
      (_options: {
        expandedSceneIds: ReadonlySet<string>;
        onSceneExpandedChange: (sceneId: string, isExpanded: boolean) => void;
      }) => null,
    );
    await render(
      <ChapterListItem
        chapter={chapter()}
        onToggleFavorite={jest.fn()}
        onViewDetails={jest.fn()}
        renderScenes={renderScenes}
        initialExpanded
      />,
    );

    expect(lastProps<ChapterSelect>().initialExpanded).toBe(true);
    const first = renderScenes.mock.calls[0][0];
    expect(first.expandedSceneIds.size).toBe(0);

    await act(async () => {
      first.onSceneExpandedChange('scene-1', true);
    });
    const second = renderScenes.mock.calls[renderScenes.mock.calls.length - 1][0];
    expect(second.expandedSceneIds.has('scene-1')).toBe(true);
  });
});

describe('CharacterListItem', () => {
  const character = (overrides: Partial<CharacterWithTags> = {}): CharacterWithTags =>
    ({
      id: 'char-1',
      name: 'Ari',
      title: 'Captain',
      gender: 'Female',
      race: 'Elf',
      subrace: 'High',
      description: 'A weathered sailor',
      tags: [],
      ...overrides,
    }) as CharacterWithTags;

  it('renders the name, title, lineage and description', async () => {
    const view = await render(
      <CharacterListItem
        character={character({ tags: [{ id: 'tag-1', name: 'Crew' }] as never })}
        onToggleFavorite={jest.fn()}
        onViewDetails={jest.fn()}
      />,
    );

    expect(view.getByText('Ari')).toBeTruthy();
    expect(view.getByText('Captain')).toBeTruthy();
    expect(view.getByText('Female - Elf (High)')).toBeTruthy();
    expect(view.getByText('A weathered sailor')).toBeTruthy();
    expect(view.getByText('Crew')).toBeTruthy();
    expect(lastProps<CharacterWithTags>().entityType).toBe('Character');
  });

  it('passes the relations expansion state through', async () => {
    const renderRelations = jest.fn(
      (_options: { expanded: boolean; onExpandedChange: (expanded: boolean) => void }) => null,
    );
    await render(
      <CharacterListItem
        character={character({ gender: null, race: null })}
        onToggleFavorite={jest.fn()}
        onViewDetails={jest.fn()}
        renderRelations={renderRelations}
      />,
    );

    const first = renderRelations.mock.calls[0][0];
    expect(first.expanded).toBe(false);
    await act(async () => {
      first.onExpandedChange(true);
    });
    const second = renderRelations.mock.calls[renderRelations.mock.calls.length - 1][0];
    expect(second.expanded).toBe(true);
  });
});

describe('ItemListItem', () => {
  const itemRow = (overrides: Partial<ItemSelect> = {}): ItemSelect =>
    ({
      id: 'item-1',
      name: 'Sword',
      description: 'A plain blade',
      category: 'Weapon',
      initialState: 'Sheathed',
      characterOwnerId: 'char-1',
      ...overrides,
    }) as ItemSelect;

  const baseProps = {
    onViewDetails: jest.fn(),
    onToggleFavorite: jest.fn(),
    characterOwnerLabel: 'Owner',
    unknownCharacterOwnerLabel: 'Nobody',
  };

  it('renders the preview, category, state and owner', async () => {
    const view = await render(
      <ItemListItem
        {...baseProps}
        item={itemRow()}
        characterOwnerName="Ari"
        tags={[{ id: 'tag-1', name: 'Relic' }] as TagSelect[]}
        renderJourneys={() => null}
      />,
    );

    expect(view.getByText('Sword')).toBeTruthy();
    expect(view.getByText('A plain blade')).toBeTruthy();
    expect(view.getByText('category: Weapon')).toBeTruthy();
    expect(view.getByText('initial_state: Sheathed')).toBeTruthy();
    expect(view.getByText('Owner: Ari')).toBeTruthy();
    expect(view.getByText('Relic')).toBeTruthy();
  });

  it('falls back when the owner name is unresolved', async () => {
    const view = await render(<ItemListItem {...baseProps} item={itemRow()} />);

    expect(view.getByText('Owner: Nobody')).toBeTruthy();
  });
});

describe('LocationListItem', () => {
  const location = (overrides: Partial<LocationWithTags> = {}): LocationWithTags =>
    ({
      id: 'loc-1',
      name: 'Harbor',
      description: 'A busy port',
      climate: 'Mild',
      culture: 'Trade',
      politics: 'Council',
      tags: [],
      ...overrides,
    }) as LocationWithTags;

  it('renders the description and the world lines', async () => {
    const view = await render(
      <LocationListItem
        location={location({ tags: [{ id: 'tag-1', name: 'City' }] as never })}
        onToggleFavorite={jest.fn()}
        onViewDetails={jest.fn()}
      />,
    );

    expect(view.getByText('Harbor')).toBeTruthy();
    expect(view.getByText('A busy port')).toBeTruthy();
    expect(view.getByText('Climate: Mild - Culture: Trade - Politics: Council')).toBeTruthy();
    expect(view.getByText('City')).toBeTruthy();
  });

  it('omits blank world lines', async () => {
    const view = await render(
      <LocationListItem
        location={location({ climate: null, culture: null, politics: null, description: null })}
        onToggleFavorite={jest.fn()}
        onViewDetails={jest.fn()}
      />,
    );

    expect(view.queryByText(/Climate:/)).toBeNull();
    expect(view.queryByText('A busy port')).toBeNull();
  });
});

describe('NoteListItem', () => {
  const note = (overrides: Partial<NoteWithTags> = {}): NoteWithTags =>
    ({
      id: 'note-1',
      title: 'Reminder',
      body: 'Water the plot',
      tags: [],
      ...overrides,
    }) as NoteWithTags;

  it('renders the title and body with optional favorites', async () => {
    const onToggleFavorite = jest.fn();
    const view = await render(
      <NoteListItem note={note()} onViewDetails={jest.fn()} onToggleFavorite={onToggleFavorite} />,
    );

    expect(view.getByText('Reminder')).toBeTruthy();
    expect(view.getByText('Water the plot')).toBeTruthy();
    expect(lastProps<NoteWithTags>().entityType).toBe('Note');
    expect(lastProps<NoteWithTags>().onToggleFavorite).toBe(onToggleFavorite);
  });

  it('passes favorites through as optional', async () => {
    await render(<NoteListItem note={note()} onViewDetails={jest.fn()} />);

    expect(lastProps<NoteWithTags>().onToggleFavorite).toBeUndefined();
  });
});

describe('PlotListItem', () => {
  const plot = (overrides: Partial<PlotSelect> = {}): PlotSelect =>
    ({ id: 'plot-1', name: 'Conspiracy', details: 'A political plot', ...overrides }) as PlotSelect;

  it.each([
    [1, 'plot_scene_count_one'],
    [0, 'plot_scene_count_other'],
    [3, 'plot_scene_count_other'],
  ])('counts %i scenes with %s', async (sceneCount, key) => {
    const view = await render(
      <PlotListItem plot={plot()} sceneCount={sceneCount} onViewDetails={jest.fn()} />,
    );

    expect(view.getByText('Conspiracy')).toBeTruthy();
    expect(view.getByText(key)).toBeTruthy();
    expect(view.getByText('A political plot')).toBeTruthy();
  });

  it('falls back when the plot has no details', async () => {
    const view = await render(
      <PlotListItem plot={plot({ details: null })} sceneCount={0} onViewDetails={jest.fn()} />,
    );

    expect(view.getByText('no_plot_details')).toBeTruthy();
  });
});

describe('SceneListItem', () => {
  const sceneRow = (overrides: Partial<SceneSelect> = {}): SceneSelect =>
    ({
      id: 'scene-1',
      name: 'Arrival',
      index: 2,
      chapterId: 'chapter-1',
      summary: 'They land',
      extraNotes: 'At dawn',
      ...overrides,
    }) as SceneSelect;

  it('numbers linear chaptered scenes and shows their preview', async () => {
    const view = await render(
      <SceneListItem
        scene={sceneRow()}
        storyType="linear"
        onToggleFavorite={jest.fn()}
        onViewDetails={jest.fn()}
        tags={[{ id: 'tag-1', name: 'Opening' }] as TagSelect[]}
      />,
    );

    expect(view.getByText('2. Arrival')).toBeTruthy();
    expect(view.getByText('They land')).toBeTruthy();
    expect(view.getByText('At dawn')).toBeTruthy();
    expect(view.getByText('Opening')).toBeTruthy();
  });

  it('keeps branching and unchaptered scenes unnumbered', async () => {
    const branching = await render(
      <SceneListItem
        scene={sceneRow()}
        storyType="branching"
        onToggleFavorite={jest.fn()}
        onViewDetails={jest.fn()}
      />,
    );
    expect(branching.getByText('Arrival')).toBeTruthy();
    expect(branching.queryByText('2. Arrival')).toBeNull();

    const loose = await render(
      <SceneListItem
        scene={sceneRow({ chapterId: null })}
        storyType="linear"
        onToggleFavorite={jest.fn()}
        onViewDetails={jest.fn()}
      />,
    );
    expect(loose.getByText('Arrival')).toBeTruthy();
  });

  it('passes density and expansion control through', async () => {
    const onExpandedChange = jest.fn();
    await render(
      <SceneListItem
        scene={sceneRow()}
        storyType="linear"
        onToggleFavorite={jest.fn()}
        onViewDetails={jest.fn()}
        density="nested"
        isExpanded
        onExpandedChange={onExpandedChange}
      />,
    );

    expect(lastProps<SceneSelect>().density).toBe('nested');
    expect(lastProps<SceneSelect>().isExpanded).toBe(true);
  });
});

describe('TagListItem', () => {
  it('renders the name, color dot and notes', async () => {
    const view = await render(
      <TagListItem
        tag={{ id: 'tag-1', name: 'Canon', color: '#f00', extraNotes: 'Keep' } as TagRow}
        onViewDetails={jest.fn()}
        onToggleFavorite={jest.fn()}
      />,
    );

    expect(view.getByText('Canon')).toBeTruthy();
    expect(view.getByText('Keep')).toBeTruthy();
    const dots = view.container.queryAll((node) => {
      const style = node.props?.style;
      if (style == null || typeof style !== 'object') return false;
      return StyleSheet.flatten(style)?.backgroundColor === '#f00';
    });
    expect(dots.length).toBeGreaterThan(0);
  });
});

describe('WorldRuleListItem', () => {
  const rule = (overrides: Partial<WorldRuleWithTags> = {}): WorldRuleWithTags =>
    ({
      id: 'rule-1',
      title: 'Tides',
      section: 'rule',
      type: 'Custom',
      description: 'The moon pulls',
      tags: [],
      ...overrides,
    }) as WorldRuleWithTags;

  it('renders the section line, description and tags', async () => {
    const view = await render(
      <WorldRuleListItem
        worldRule={rule({ tags: [{ id: 'tag-1', name: 'Sea' }] as never })}
        onToggleFavorite={jest.fn()}
        onViewDetails={jest.fn()}
      />,
    );

    expect(view.getByText('Tides')).toBeTruthy();
    expect(view.getByText(/world_piece_section_rule/)).toBeTruthy();
    expect(view.getByText('The moon pulls')).toBeTruthy();
    expect(view.getByText('Sea')).toBeTruthy();
    expect(lastProps<WorldRuleWithTags>().entityAppearance).toBeTruthy();
  });
});
