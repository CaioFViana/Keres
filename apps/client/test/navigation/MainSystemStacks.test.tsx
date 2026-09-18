/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react-native';
import React from 'react';

const mockNavigatorProps: Array<Record<string, any>> = [];
const mockScreens: Array<Record<string, any>> = [];

jest.mock('@react-navigation/native-stack', () => ({
  __esModule: true,
  createNativeStackNavigator: () => ({
    Navigator: ({ children, ...props }: { children: React.ReactNode }) => {
      mockNavigatorProps.push(props);
      return <>{children}</>;
    },
    Screen: (props: Record<string, any>) => {
      mockScreens.push(props);
      return null;
    },
  }),
}));
jest.mock('../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: jest.fn(),
}));
jest.mock('../../src/screens/boards/BoardCanvasScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/boards/BoardListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/characterrelations/CharacterRelationGraphScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/characters/CharacterDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/characters/CharacterFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/characters/CharacterListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/comments/CommentListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/customization/CustomizationIndexScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/customization/StoryAppearanceScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/customization/StoryArcFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/customization/StoryArcListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/customization/VocabularyScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/gallery/GalleryDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/gallery/GalleryListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/itemJourneys/ItemJourneyDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/itemJourneys/ItemJourneyFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/items/ItemDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/items/ItemFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/items/ItemListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/location-maps/LocationMapListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/location-maps/LocationMapScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/locations/LocationDetailsScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/locations/LocationFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/locations/LocationGraphScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/locations/LocationListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/narrative-elements/chapters/ChapterDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/narrative-elements/chapters/ChapterFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/narrative-elements/chapters/NarrativeElementsListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/narrative-elements/choices/ChoiceDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/narrative-elements/choices/ChoiceFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/narrative-elements/choices/ChoiceViewScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/narrative-elements/scenes/SceneDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/narrative-elements/scenes/SceneFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/narrative-elements/timeline/StoryTimelineScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/notes/NoteDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/notes/NoteFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/notes/NoteListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/operationlog/OperationLogDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/operationlog/OperationLogListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/plots/PlotDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/plots/PlotFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/plots/PlotListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/plots/PlotMatrixScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/plots/PlotProgressScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/plots/PlotReaderScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/routes/RouteDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/routes/RouteFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/routes/RouteListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/routes/RouteReaderScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/routes/RouteStepsScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/routes/RouteTimelineScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/routes/StoryNavigatorScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/stats/StatComparisonScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/stats/StatFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/stats/StatLadderScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/stats/StatListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/stats/StatRankingScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/storycalendars/StoryAgendaScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/storycalendars/StoryCalendarFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/storycalendars/StoryCalendarListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/storyschema/StorySchemaFieldFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/storyschema/StorySchemaListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/suggestions/SuggestionsScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/suggestions/SuggestionUsageScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/tags/TagDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/tags/TagFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/tags/TagListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/worldrules/WorldIndexScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/worldrules/WorldRuleDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/worldrules/WorldRuleFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/worldrules/WorldRuleListScreen', () => ({
  __esModule: true,
  default: () => null,
}));

import { useBackButtonHandler } from '../../src/hooks/useBackButtonHandler';
import {
  BoardsStackNavigator,
  CharacterStackNavigator,
  CommentsStackNavigator,
  CustomizationStackNavigator,
  GalleryStackNavigator,
  ItemStackNavigator,
  LocationStackNavigator,
  NarrativeElementsStackNavigator,
  NoteStackNavigator,
  OperationLogStackNavigator,
  PlotsStackNavigator,
  TagStackNavigator,
  WorldRuleStackNavigator,
} from '../../src/navigation/MainSystemStacks';
import { resetShowcaseRequestCacheForTests } from '../../src/showcase/showcaseRequest';

const stacks: Array<{
  label: string;
  Navigator: () => React.JSX.Element;
  screens: string[];
  initialRouteName?: string;
}> = [
  {
    label: 'PlotsStack',
    Navigator: PlotsStackNavigator,
    screens: [
      'Plots',
      'PlotDetail',
      'PlotForm',
      'PlotMatrix',
      'PlotProgress',
      'PlotReader',
      'Routes',
      'RouteForm',
      'RouteDetail',
      'RouteSteps',
      'RouteReader',
      'RouteTimeline',
      'StoryNavigator',
    ],
    initialRouteName: 'Plots',
  },
  {
    label: 'CharactersStack',
    Navigator: CharacterStackNavigator,
    screens: ['Characters', 'CharacterDetail', 'CharacterForm', 'CharacterRelationView'],
    initialRouteName: 'Characters',
  },
  {
    label: 'NarrativeElementsStack',
    Navigator: NarrativeElementsStackNavigator,
    screens: [
      'NarrativeElements',
      'ChapterDetail',
      'ChapterForm',
      'SceneDetail',
      'SceneForm',
      'ChoiceDetail',
      'ChoiceForm',
      'ChoiceView',
      'StoryTimeline',
    ],
    initialRouteName: 'NarrativeElements',
  },
  {
    label: 'ItemsStack',
    Navigator: ItemStackNavigator,
    screens: ['Items', 'ItemDetail', 'ItemForm', 'ItemJourneyDetail', 'ItemJourneyForm'],
    initialRouteName: 'Items',
  },
  {
    label: 'LocationsStack',
    Navigator: LocationStackNavigator,
    screens: [
      'Locations',
      'LocationDetail',
      'LocationForm',
      'LocationView',
      'LocationMapList',
      'LocationMap',
    ],
    initialRouteName: 'Locations',
  },
  {
    label: 'GalleryStack',
    Navigator: GalleryStackNavigator,
    screens: ['GalleryList', 'GalleryDetail'],
  },
  {
    label: 'BoardsStack',
    Navigator: BoardsStackNavigator,
    screens: ['BoardList', 'BoardCanvas'],
  },
  {
    label: 'TagsStack',
    Navigator: TagStackNavigator,
    screens: ['Tags', 'TagDetail', 'TagForm'],
  },
  {
    label: 'NotesStack',
    Navigator: NoteStackNavigator,
    screens: ['Notes', 'NoteDetail', 'NoteForm'],
  },
  {
    label: 'WorldRulesStack',
    Navigator: WorldRuleStackNavigator,
    screens: ['WorldIndex', 'WorldRules', 'WorldRuleDetail', 'WorldRuleForm'],
  },
  {
    label: 'OperationLogStack',
    Navigator: OperationLogStackNavigator,
    screens: ['OperationLog', 'OperationLogDetail'],
  },
  {
    label: 'CommentsStack',
    Navigator: CommentsStackNavigator,
    screens: ['CommentsList'],
  },
  {
    label: 'CustomizationStack',
    Navigator: CustomizationStackNavigator,
    screens: [
      'CustomizationIndex',
      'StoryAppearance',
      'Vocabulary',
      'StoryArcList',
      'StoryArcForm',
      'StoryCalendarList',
      'StoryCalendarForm',
      'StoryAgenda',
      'StorySchemaList',
      'StorySchemaFieldForm',
      'Suggestions',
      'SuggestionUsage',
      'StatList',
      'StatForm',
      'StatLadder',
      'StatComparison',
      'StatRanking',
    ],
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigatorProps.length = 0;
  mockScreens.length = 0;
  resetShowcaseRequestCacheForTests();
});

afterEach(() => resetShowcaseRequestCacheForTests());

it.each(stacks.map((stack) => [stack.label, stack] as const))(
  '%s registers its screens without a header and handles the back button',
  async (_label, stack) => {
    await render(<stack.Navigator />);

    expect(mockNavigatorProps).toHaveLength(1);
    // Stacks without an explicit initial route pass no `initialRouteName` prop at all, so only
    // expect the key when the stack declares one (`toMatchObject` fails `undefined` vs missing).
    const expectedNavigator: Record<string, unknown> = {
      screenOptions: { headerShown: false },
    };
    if (stack.initialRouteName !== undefined) {
      expectedNavigator.initialRouteName = stack.initialRouteName;
    }
    expect(mockNavigatorProps[0]).toMatchObject(expectedNavigator);
    expect(mockScreens.map((screen) => screen.name)).toEqual(stack.screens);
    expect(useBackButtonHandler).toHaveBeenCalledTimes(1);
  },
);

it('opens the showcase screen when the capture targets this stack', async () => {
  const originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, search: '?showcase=story&stack=PlotsStack&screen=PlotMatrix' },
  });
  resetShowcaseRequestCacheForTests();
  try {
    await render(<PlotsStackNavigator />);
    expect(mockNavigatorProps[0]).toMatchObject({ initialRouteName: 'PlotMatrix' });
  } finally {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    resetShowcaseRequestCacheForTests();
  }
});
