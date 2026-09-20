import { fireEvent, render, type RenderResult } from '@testing-library/react-native';
import ItemJourneyTimeline from '../../src/components/features/item-journeys/ItemJourney/ItemJourneyTimeline';
import ItemJourneyRows from '../../src/components/features/item-journeys/ItemJourneyRows';
import type { ItemJourneySelect, ItemSelect, SceneSelect } from '../../src/db/schema';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
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
  useVocabularyEntityCopy: (type: string) =>
    type === 'Item'
      ? { itemJourney: 'Journey', itemJourneys: 'Journeys' }
      : { entity: type, unknown: `Unknown ${type}` },
}));

const mockChapterNameOf = jest.fn(
  (_chapterId: string | null | undefined): string | undefined => 'Chapter One',
);
jest.mock('../../src/hooks/useChapterNames', () => ({
  useChapterNames: () => mockChapterNameOf,
}));

const mockUseItemJourneyTimelineData = jest.fn();
jest.mock('../../src/hooks/useItemJourneyTimelineData', () => ({
  useItemJourneyTimelineData: (...args: unknown[]) => mockUseItemJourneyTimelineData(...args),
}));

const mockDateForScene = jest.fn((_scene: unknown): { date: string } | null => null);
jest.mock('../../src/hooks/useSceneCalendarDates', () => ({
  useSceneCalendarDates: () => ({ dateForScene: mockDateForScene }),
}));

const mockNavigateToDetail = jest.fn();
jest.mock('../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => mockNavigateToDetail,
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../src/utils/itemJourneyOrder', () => ({
  orderItemJourneysByNarrative: (journeys: unknown[]) => journeys,
}));

const scene = (overrides: Partial<SceneSelect> = {}): SceneSelect =>
  ({ id: 'scene-1', name: 'Arrival', chapterId: 'chapter-1', ...overrides }) as SceneSelect;

const journey = (overrides: Partial<ItemJourneySelect> = {}): ItemJourneySelect =>
  ({ id: 'journey-1', sceneId: 'scene-1', newState: 'Drawn', ...overrides }) as ItemJourneySelect;

const item = (overrides: Partial<ItemSelect> = {}): ItemSelect =>
  ({
    id: 'item-1',
    name: 'Sword',
    initialState: 'Sheathed',
    characterOwnerId: null,
    ...overrides,
  }) as ItemSelect;

/** Journey rows and cards carry no accessibility labels, so press through their text. */
async function pressText(view: RenderResult, text: string) {
  await fireEvent.press(view.getByText(text));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockChapterNameOf.mockReturnValue('Chapter One');
  mockDateForScene.mockReturnValue(null);
});

describe('ItemJourneyRows', () => {
  const scenes = [scene()];

  it('lists journeys with their scene and chapter', async () => {
    const onOpenJourney = jest.fn();
    const view = await render(
      <ItemJourneyRows
        journeys={[journey(), journey({ id: 'journey-2', sceneId: 'missing', newState: 'Lost' })]}
        scenes={scenes}
        canEdit
        onOpenJourney={onOpenJourney}
        onAddJourney={jest.fn()}
      />,
    );

    expect(view.getByText('Journeys')).toBeTruthy();
    expect(view.getByText('Arrival · Chapter One')).toBeTruthy();
    expect(view.getByText('Drawn')).toBeTruthy();
    expect(view.getByText('Unknown Scene')).toBeTruthy();
    expect(view.getByText('Lost')).toBeTruthy();

    await pressText(view, 'Drawn');
    expect(onOpenJourney).toHaveBeenCalledWith('journey-1');
  });

  it('omits the chapter when the scene has none', async () => {
    mockChapterNameOf.mockReturnValue(undefined);
    const view = await render(
      <ItemJourneyRows
        journeys={[journey()]}
        scenes={scenes}
        canEdit={false}
        onOpenJourney={jest.fn()}
        onAddJourney={jest.fn()}
      />,
    );

    expect(view.getByText('Arrival')).toBeTruthy();
    expect(view.queryByText('Arrival · Chapter One')).toBeNull();
    expect(view.queryByText('vocabulary_create_entity')).toBeNull();
  });

  it('adds a journey when editable', async () => {
    const onAddJourney = jest.fn();
    const view = await render(
      <ItemJourneyRows
        journeys={[]}
        scenes={scenes}
        canEdit
        onOpenJourney={jest.fn()}
        onAddJourney={onAddJourney}
      />,
    );

    await pressText(view, 'vocabulary_create_entity');
    expect(onAddJourney).toHaveBeenCalledTimes(1);
  });
});

describe('ItemJourneyTimeline', () => {
  const timelineData = {
    journeys: [journey()],
    scenes: [scene()],
    chapters: [],
    choices: [],
    characters: [{ id: 'char-1', name: 'Ari' }],
    loading: false,
  };

  beforeEach(() => {
    mockUseItemJourneyTimelineData.mockReturnValue(timelineData);
  });

  it('shows the loading copy', async () => {
    mockUseItemJourneyTimelineData.mockReturnValue({ ...timelineData, loading: true });
    const view = await render(
      <ItemJourneyTimeline item={item()} storyId="story-1" storyType="linear" />,
    );

    expect(view.getByText('Journeys')).toBeTruthy();
    expect(view.getByText('loading')).toBeTruthy();
  });

  it('renders the origin, the stops and the add card', async () => {
    mockDateForScene.mockReturnValue({ date: 'Day 1' });
    const view = await render(
      <ItemJourneyTimeline
        item={item({ characterOwnerId: 'char-1' })}
        storyId="story-1"
        storyType="linear"
      />,
    );

    expect(view.getByText('item_journey_origin')).toBeTruthy();
    expect(view.getByText('Sheathed')).toBeTruthy();
    expect(view.getByText('Ari')).toBeTruthy();
    expect(view.getByText('Arrival')).toBeTruthy();
    expect(view.getByText('Drawn')).toBeTruthy();
    expect(view.getByText('Day 1')).toBeTruthy();
    expect(view.getByText('add_item_journey')).toBeTruthy();
  });

  it('falls back for missing scenes, states and dates', async () => {
    mockDateForScene.mockReturnValue(null);
    mockUseItemJourneyTimelineData.mockReturnValue({
      ...timelineData,
      journeys: [journey({ sceneId: 'missing' })],
    });
    const view = await render(
      <ItemJourneyTimeline
        item={item({ initialState: null })}
        storyId="story-1"
        storyType="linear"
      />,
    );

    expect(view.getByText('common_na')).toBeTruthy();
    expect(view.getByText('unknown_scene')).toBeTruthy();
  });

  it('opens journeys and adds the next one', async () => {
    const view = await render(
      <ItemJourneyTimeline item={item()} storyId="story-1" storyType="linear" />,
    );

    await pressText(view, 'Drawn');
    expect(mockNavigateToDetail).toHaveBeenCalledWith('ItemJourney', 'journey-1');

    await pressText(view, 'add_item_journey');
    expect(mockNavigate).toHaveBeenCalledWith('ItemJourneyForm', { itemId: 'item-1' });
  });
});
