import { cleanup, render, waitFor } from '@testing-library/react-native';

const mockGoBack = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockUseScreenTour = jest.fn();
const mockCountForStory = jest.fn();
const mockCountRelations = jest.fn();
const mockGetPlan = jest.fn();

let mockSelectedStory: { id: string; serverId?: string | null } | null = { id: 'story-1' };

const mockNavigation = { goBack: mockGoBack };
const mockT = ((key: string) => key) as (key: string) => string;
const mockDrizzleDb = {};
const mockColors = {
  primary: '#0000ff',
  primaryContainer: '#eeeeff',
  onPrimaryContainer: '#000066',
  secondary: '#008888',
  accent: '#ffaa00',
  background: '#ffffff',
  surface: '#f5f5f5',
  card: '#ffffff',
  text: '#111111',
  textSecondary: '#555555',
  border: '#dddddd',
  error: '#ff0000',
};

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => mockNavigation,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDrizzleDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => mockUseScreenHeader(config),
}));
jest.mock('../../../src/services/storymanagement/StoryEntityCountService', () => ({
  __esModule: true,
  createStoryEntityCountService: () => ({
    countForStory: mockCountForStory,
    countRelationsForStory: mockCountRelations,
  }),
}));
jest.mock('../../../src/services/StoryPlanService', () => ({
  __esModule: true,
  createStoryPlanService: () => ({ getPlan: mockGetPlan }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: mockColors }),
}));
jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    term: (value: string, plural?: boolean) => (plural ? `${value}s` : value),
  }),
}));
jest.mock('../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: ({ message }: { message?: string }) => (
      <Text testID="screen-loading">{message ?? 'loading'}</Text>
    ),
    ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => (
      <Text testID="screen-error" onPress={onGoBack}>
        {message}
      </Text>
    ),
  };
});
jest.mock('react-i18next', () => {
  const actual = jest.requireActual('react-i18next');
  return {
    ...actual,
    __esModule: true,
    useTranslation: () => ({ t: mockT }),
  };
});

import StoryEntityCountScreen from '../../../src/screens/mainstorystack/StoryEntityCountScreen';

describe('StoryEntityCountScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedStory = { id: 'story-1' };
    mockCountForStory.mockResolvedValue({ total: 0, byType: {} });
    mockCountRelations.mockResolvedValue({ total: 0, byType: {} });
    mockGetPlan.mockResolvedValue(null);
  });

  it('requests its guided tour and owns the header of the stack it sits in', async () => {
    await render(<StoryEntityCountScreen />);

    expect(mockUseScreenTour).toHaveBeenCalledWith('StoryEntityCount');
    expect(mockUseScreenHeader).toHaveBeenCalledWith({
      target: 'parent',
      title: 'entity_count_title',
    });
  });

  it('reports how many entities the story has, by type, the way the plan counts them', async () => {
    mockCountForStory.mockResolvedValue({
      total: 5,
      byType: { Character: 3, Gallery: 2 },
    });
    const view = await render(<StoryEntityCountScreen />);

    await waitFor(() => expect(mockCountForStory).toHaveBeenCalledWith('story-1'));
    await waitFor(() => expect(view.queryByTestId('entity-count-card')).not.toBeNull());
    expect(view.getByTestId('entity-count-total').props.children).toBe(5);
    // A vocabulary type takes the story's own word, the others a plain label.
    expect(view.getByText('Characters')).toBeTruthy();
    expect(view.getByText('entity_count_gallery')).toBeTruthy();
    expect(view.queryByTestId('entity-count-Location')).toBeNull();
    // Only on this device: no plan, and the note says nothing limits it.
    expect(view.queryByTestId('entity-count-plan')).toBeNull();
    expect(view.getByText('entity_count_hint_local')).toBeTruthy();
  });

  it('shows the links and values in a second card of their own, with no plan and no limit', async () => {
    mockSelectedStory = { id: 'story-1', serverId: 'server-1' };
    mockCountForStory.mockResolvedValue({ total: 4, byType: { Character: 4 } });
    mockCountRelations.mockResolvedValue({
      total: 11,
      byType: { TagRelation: 9, AttributeValue: 2 },
    });
    mockGetPlan.mockResolvedValue({
      tierName: 'Pro',
      maxEntitiesPerStory: 500,
      maxEntitiesTotal: null,
      entitiesUsedTotal: 0,
    });
    const view = await render(<StoryEntityCountScreen />);

    await waitFor(() => expect(view.queryByTestId('entity-count-relations-card')).not.toBeNull());
    expect(mockCountRelations).toHaveBeenCalledWith('story-1');
    expect(view.getByTestId('entity-count-relations-total').props.children).toBe(11);
    expect(view.getByText('entity_count_tag_relation')).toBeTruthy();
    expect(view.getByText('entity_count_attribute_value')).toBeTruthy();
    expect(view.getByText('entity_count_relations_hint')).toBeTruthy();
    // The plan's bars belong to the first card only: this one counts toward nothing.
    expect(view.getAllByTestId('entity-count-plan')).toHaveLength(1);
    expect(view.getByTestId('entity-count-total').props.children).toBe(4);
  });

  it('says there are no links or values yet, when there are none', async () => {
    const view = await render(<StoryEntityCountScreen />);

    await waitFor(() => expect(view.queryByTestId('entity-count-relations-card')).not.toBeNull());
    expect(view.getByText('entity_count_relations_empty')).toBeTruthy();
  });

  it('shows the owner plan against the count when the story lives on a server', async () => {
    mockSelectedStory = { id: 'story-1', serverId: 'server-1' };
    mockCountForStory.mockResolvedValue({ total: 251, byType: { Character: 251 } });
    mockGetPlan.mockResolvedValue({
      tierName: 'Pro',
      maxEntitiesPerStory: 500,
      maxEntitiesTotal: 900,
      entitiesUsedTotal: 640,
    });
    const view = await render(<StoryEntityCountScreen />);

    await waitFor(() => expect(view.queryByTestId('entity-count-plan')).not.toBeNull());
    expect(mockGetPlan).toHaveBeenCalledWith('server-1', 'story-1');
    expect(view.getByText('entity_count_plan_named')).toBeTruthy();
    expect(view.getByText('251 / 500')).toBeTruthy();
    expect(view.getByText('640 / 900')).toBeTruthy();
    expect(view.getByText('entity_count_hint')).toBeTruthy();
  });

  it('keeps the count when the plan cannot be read', async () => {
    mockSelectedStory = { id: 'story-1', serverId: 'server-1' };
    mockCountForStory.mockResolvedValue({ total: 5, byType: { Character: 5 } });
    mockGetPlan.mockRejectedValue(new Error('offline'));
    const view = await render(<StoryEntityCountScreen />);

    await waitFor(() => expect(view.queryByTestId('entity-count-card')).not.toBeNull());
    expect(view.queryByTestId('entity-count-plan')).toBeNull();
  });

  it('shows an error, with a way out, when the entities cannot be counted', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockCountForStory.mockRejectedValue(new Error('count down'));
    try {
      const view = await render(<StoryEntityCountScreen />);
      await waitFor(() => expect(view.queryByTestId('screen-error')).not.toBeNull());
      expect(view.getByTestId('screen-error').props.children).toBe('entity_count_failed');
    } finally {
      errorSpy.mockRestore();
    }
  });
});
