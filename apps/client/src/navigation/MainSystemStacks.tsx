import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useBackButtonHandler } from '../hooks/useBackButtonHandler';
import BoardCanvasScreen from '../screens/boards/BoardCanvasScreen';
import BoardListScreen from '../screens/boards/BoardListScreen';
import SketchCanvasScreen from '../screens/sketches/SketchCanvasScreen';
import SketchListScreen from '../screens/sketches/SketchListScreen';
import SongEditorScreen from '../screens/songs/SongEditorScreen';
import SongListScreen from '../screens/songs/SongListScreen';
import CharacterRelationGraphScreen from '../screens/characterrelations/CharacterRelationGraphScreen';
import type { CharacterDetailScreenParamList } from '../screens/characters/CharacterDetailScreen';
import CharacterDetailScreen from '../screens/characters/CharacterDetailScreen';
import CharacterFormScreen from '../screens/characters/CharacterFormScreen';
import CharactersScreen from '../screens/characters/CharacterListScreen';
import CommentListScreen from '../screens/comments/CommentListScreen';
import GalleryDetailScreen from '../screens/gallery/GalleryDetailScreen';
import GalleryListScreen from '../screens/gallery/GalleryListScreen';
import ItemJourneyDetailScreen from '../screens/itemJourneys/ItemJourneyDetailScreen';
import ItemJourneyFormScreen from '../screens/itemJourneys/ItemJourneyFormScreen';
import ItemDetailScreen from '../screens/items/ItemDetailScreen';
import ItemFormScreen from '../screens/items/ItemFormScreen';
import ItemListScreen from '../screens/items/ItemListScreen';
import LocationMapListScreen from '../screens/location-maps/LocationMapListScreen';
import LocationMapScreen from '../screens/location-maps/LocationMapScreen';
import type { LocationDetailScreenParamList } from '../screens/locations/LocationDetailsScreen';
import LocationDetailsScreen from '../screens/locations/LocationDetailsScreen';
import LocationFormScreen from '../screens/locations/LocationFormScreen';
import LocationGraphScreen from '../screens/locations/LocationGraphScreen';
import LocationListScreen from '../screens/locations/LocationListScreen';
import type { ChapterDetailScreenParamList } from '../screens/narrative-elements/chapters/ChapterDetailScreen';
import ChapterDetailScreen from '../screens/narrative-elements/chapters/ChapterDetailScreen';
import ChapterFormScreen from '../screens/narrative-elements/chapters/ChapterFormScreen';
import NarrativeElementsListScreen from '../screens/narrative-elements/chapters/NarrativeElementsListScreen';
import ChoiceDetailScreen from '../screens/narrative-elements/choices/ChoiceDetailScreen';
import ChoiceFormScreen from '../screens/narrative-elements/choices/ChoiceFormScreen';
import ChoiceViewScreen from '../screens/narrative-elements/choices/ChoiceViewScreen';
import ManuscriptExportScreen from '../screens/narrative-elements/scenes/ManuscriptExportScreen';
import ManuscriptScreen from '../screens/narrative-elements/scenes/ManuscriptScreen';
import SceneDetailScreen from '../screens/narrative-elements/scenes/SceneDetailScreen';
import FountainImportScreen from '../screens/narrative-elements/scenes/FountainImportScreen';
import NewSessionScreen from '../screens/narrative-elements/scenes/NewSessionScreen';
import ScenePagesScreen from '../screens/narrative-elements/scenes/ScenePagesScreen';
import SceneMusicScreen from '../screens/narrative-elements/scenes/SceneMusicScreen';
import SceneEditorScreen from '../screens/narrative-elements/scenes/SceneEditorScreen';
import SceneFormScreen from '../screens/narrative-elements/scenes/SceneFormScreen';
import StoryTimelineScreen from '../screens/narrative-elements/timeline/StoryTimelineScreen';
import type { NoteDetailScreenParamList } from '../screens/notes/NoteDetailScreen';
import NoteDetailScreen from '../screens/notes/NoteDetailScreen';
import NoteFormScreen from '../screens/notes/NoteFormScreen';
import NotesScreen from '../screens/notes/NoteListScreen';
import OperationLogDetailScreen from '../screens/operationlog/OperationLogDetailScreen';
import OperationLogScreen from '../screens/operationlog/OperationLogListScreen';
import StoryAnalysisScreen from '../screens/mainstorystack/StoryAnalysisScreen';
import StoryEntityCountScreen from '../screens/mainstorystack/StoryEntityCountScreen';
import PlotDetailScreen from '../screens/plots/PlotDetailScreen';
import PlotFormScreen from '../screens/plots/PlotFormScreen';
import PlotListScreen from '../screens/plots/PlotListScreen';
import PlotMatrixScreen from '../screens/plots/PlotMatrixScreen';
import PlotProgressScreen from '../screens/plots/PlotProgressScreen';
import PlotReaderScreen from '../screens/plots/PlotReaderScreen';
import RouteDetailScreen from '../screens/routes/RouteDetailScreen';
import RouteFormScreen from '../screens/routes/RouteFormScreen';
import RouteListScreen from '../screens/routes/RouteListScreen';
import RouteReaderScreen from '../screens/routes/RouteReaderScreen';
import RouteStepsScreen from '../screens/routes/RouteStepsScreen';
import RouteTimelineScreen from '../screens/routes/RouteTimelineScreen';
import StoryNavigatorScreen from '../screens/routes/StoryNavigatorScreen';
import type { TagDetailScreenParamList } from '../screens/tags/TagDetailScreen';
import TagDetailScreen from '../screens/tags/TagDetailScreen';
import TagFormScreen from '../screens/tags/TagFormScreen';
import TagsScreen from '../screens/tags/TagListScreen';
import type { WorldRuleDetailScreenParamList } from '../screens/worldrules/WorldRuleDetailScreen';
import WorldRuleDetailScreen from '../screens/worldrules/WorldRuleDetailScreen';
import WorldRuleFormScreen from '../screens/worldrules/WorldRuleFormScreen';
import WorldRulesScreen from '../screens/worldrules/WorldRuleListScreen';
import { showcaseInitialRoute } from '../showcase/showcaseRequest';
import type { OccurrenceTarget } from '../utils/occurrenceTarget';

/**
 * The main drawer's nested stacks: one navigator per drawer section (characters, plots,
 * locations, ...), mounted as sibling `Drawer.Screen`s in `MainSystemStack`.
 *
 * Every navigator hides its own header (`headerShown: false`) because the drawer draws the
 * single shared header (back button, help shortcut, contextual actions); each screen sets
 * its own header content through the drawer via `getParent()?.setOptions(...)`. Every
 * navigator also installs `useBackButtonHandler` so Android hardware back pops the nested
 * stack (closing an open drawer first) instead of leaving the app. Navigators with a
 * showcase entry point resolve their initial route through `showcaseInitialRoute` so
 * screen captures open without flashing the list first.
 */
//#region Plots
const PlotsStack = createNativeStackNavigator<PlotsStackParamList>();
export type PlotsStackParamList = {
  Plots: undefined;
  PlotDetail: { plotId: string; occurrence?: OccurrenceTarget };
  PlotForm: { plotId?: string };
  PlotMatrix: undefined;
  PlotProgress: undefined;
  PlotReader: undefined;
  Routes: undefined;
  RouteDetail: { routeId: string; occurrence?: OccurrenceTarget };
  RouteForm: { routeId?: string };
  RouteSteps: { routeId: string };
  RouteReader: { routeId: string };
  RouteTimeline: { routeId: string };
  StoryNavigator: undefined;
};
export const PlotsStackNavigator = () => {
  useBackButtonHandler();
  return (
    <PlotsStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={showcaseInitialRoute('PlotsStack', 'Plots')}
    >
      <PlotsStack.Screen name="Plots" component={PlotListScreen} />
      <PlotsStack.Screen name="PlotDetail" component={PlotDetailScreen} />
      <PlotsStack.Screen name="PlotForm" component={PlotFormScreen} />
      <PlotsStack.Screen name="PlotMatrix" component={PlotMatrixScreen} />
      <PlotsStack.Screen name="PlotProgress" component={PlotProgressScreen} />
      <PlotsStack.Screen name="PlotReader" component={PlotReaderScreen} />
      <PlotsStack.Screen name="Routes" component={RouteListScreen} />
      <PlotsStack.Screen name="RouteForm" component={RouteFormScreen} />
      <PlotsStack.Screen name="RouteDetail" component={RouteDetailScreen} />
      <PlotsStack.Screen name="RouteSteps" component={RouteStepsScreen} />
      <PlotsStack.Screen name="RouteReader" component={RouteReaderScreen} />
      <PlotsStack.Screen name="RouteTimeline" component={RouteTimelineScreen} />
      <PlotsStack.Screen name="StoryNavigator" component={StoryNavigatorScreen} />
    </PlotsStack.Navigator>
  );
};
//#endregion

//#region Character

const CharacterStack = createNativeStackNavigator<CharacterStackParamList>();

export type CharacterStackParamList = {
  Characters: undefined;
  CharacterDetail: CharacterDetailScreenParamList['CharacterDetail'];
  CharacterForm: { characterId?: string };
  CharacterRelationView: undefined;
};

export const CharacterStackNavigator = () => {
  useBackButtonHandler();
  return (
    <CharacterStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={showcaseInitialRoute('CharactersStack', 'Characters')}
    >
      <CharacterStack.Screen name="Characters" component={CharactersScreen} />
      <CharacterStack.Screen name="CharacterDetail" component={CharacterDetailScreen} />
      <CharacterStack.Screen name="CharacterForm" component={CharacterFormScreen} />
      <CharacterStack.Screen
        name="CharacterRelationView"
        component={CharacterRelationGraphScreen}
      />
    </CharacterStack.Navigator>
  );
};
//#endregion
//#region Narrative elements

const NarrativeElementsStack = createNativeStackNavigator<NarrativeElementsStackParamList>();

export type NarrativeElementsStackParamList = {
  NarrativeElements: undefined;
  ChapterDetail: ChapterDetailScreenParamList['ChapterDetail'];
  ChapterForm: { chapterId?: string };
  SceneDetail: { sceneId: string; occurrence?: OccurrenceTarget };
  SceneEditor: { sceneId: string };
  ScenePages: { sceneId: string };
  SceneMusic: { sceneId: string };
  NewSession: undefined;
  FountainImport: undefined;
  Manuscript: { routeId?: string };
  ManuscriptExport: undefined;
  SceneForm: { sceneId?: string; chapterId?: string };
  ChoiceDetail: { choiceId: string; occurrence?: OccurrenceTarget };
  ChoiceForm: { choiceId?: string; sceneId?: string };
  ChoiceView: undefined;
  StoryTimeline: undefined;
};

export const NarrativeElementsStackNavigator = () => {
  useBackButtonHandler();
  return (
    <NarrativeElementsStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={showcaseInitialRoute('NarrativeElementsStack', 'NarrativeElements')}
    >
      <NarrativeElementsStack.Screen
        name="NarrativeElements"
        component={NarrativeElementsListScreen}
      />
      <NarrativeElementsStack.Screen name="ChapterDetail" component={ChapterDetailScreen} />
      <NarrativeElementsStack.Screen name="ChapterForm" component={ChapterFormScreen} />
      <NarrativeElementsStack.Screen name="SceneDetail" component={SceneDetailScreen} />
      <NarrativeElementsStack.Screen name="SceneEditor" component={SceneEditorScreen} />
      <NarrativeElementsStack.Screen name="ScenePages" component={ScenePagesScreen} />
      <NarrativeElementsStack.Screen name="SceneMusic" component={SceneMusicScreen} />
      <NarrativeElementsStack.Screen name="NewSession" component={NewSessionScreen} />
      <NarrativeElementsStack.Screen name="FountainImport" component={FountainImportScreen} />
      <NarrativeElementsStack.Screen name="Manuscript" component={ManuscriptScreen} />
      <NarrativeElementsStack.Screen name="ManuscriptExport" component={ManuscriptExportScreen} />
      <NarrativeElementsStack.Screen name="SceneForm" component={SceneFormScreen} />
      <NarrativeElementsStack.Screen name="ChoiceDetail" component={ChoiceDetailScreen} />
      <NarrativeElementsStack.Screen name="ChoiceForm" component={ChoiceFormScreen} />
      <NarrativeElementsStack.Screen name="ChoiceView" component={ChoiceViewScreen} />
      <NarrativeElementsStack.Screen name="StoryTimeline" component={StoryTimelineScreen} />
    </NarrativeElementsStack.Navigator>
  );
};
//#endregion
//#region Item

const ItemStack = createNativeStackNavigator<ItemStackParamList>();

export type ItemDetailScreenParamList = {
  ItemDetail: { itemId: string; occurrence?: OccurrenceTarget };
};

export type ItemStackParamList = {
  Items: undefined;
  ItemDetail: ItemDetailScreenParamList['ItemDetail'];
  ItemForm: { itemId?: string };
  ItemJourneyDetail: { itemJourneyId: string; occurrence?: OccurrenceTarget };
  ItemJourneyForm: { itemJourneyId?: string; itemId?: string };
};

export const ItemStackNavigator = () => {
  useBackButtonHandler();
  return (
    <ItemStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={showcaseInitialRoute('ItemsStack', 'Items')}
    >
      <ItemStack.Screen name="Items" component={ItemListScreen} />
      <ItemStack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <ItemStack.Screen name="ItemForm" component={ItemFormScreen} />
      <ItemStack.Screen name="ItemJourneyDetail" component={ItemJourneyDetailScreen} />
      <ItemStack.Screen name="ItemJourneyForm" component={ItemJourneyFormScreen} />
    </ItemStack.Navigator>
  );
};
//#endregion
//#region Location

const LocationStack = createNativeStackNavigator<LocationStackParamList>();

export type LocationStackParamList = {
  Locations: undefined;
  LocationDetail: LocationDetailScreenParamList['LocationDetail'];
  LocationForm: { locationId?: string };
  LocationView: undefined;
  LocationMapList: undefined;
  LocationMap: { mapId: string };
};

export const LocationStackNavigator = () => {
  useBackButtonHandler();
  return (
    <LocationStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={showcaseInitialRoute('LocationsStack', 'Locations')}
    >
      <LocationStack.Screen name="Locations" component={LocationListScreen} />
      <LocationStack.Screen name="LocationDetail" component={LocationDetailsScreen} />
      <LocationStack.Screen name="LocationForm" component={LocationFormScreen} />
      <LocationStack.Screen name="LocationView" component={LocationGraphScreen} />
      <LocationStack.Screen name="LocationMapList" component={LocationMapListScreen} />
      <LocationStack.Screen name="LocationMap" component={LocationMapScreen} />
    </LocationStack.Navigator>
  );
};
//#endregion
//#region Gallery

const GalleryStack = createNativeStackNavigator<GalleryStackParamList>();

export type GalleryStackParamList = {
  GalleryList: undefined;
  GalleryDetail: { galleryId: string };
};

export const GalleryStackNavigator = () => {
  useBackButtonHandler();
  return (
    <GalleryStack.Navigator screenOptions={{ headerShown: false }}>
      <GalleryStack.Screen name="GalleryList" component={GalleryListScreen} />
      <GalleryStack.Screen name="GalleryDetail" component={GalleryDetailScreen} />
    </GalleryStack.Navigator>
  );
};
//#endregion
//#region Boards

const BoardsStack = createNativeStackNavigator<BoardStackParamList>();

export type BoardStackParamList = {
  BoardList: undefined;
  BoardCanvas: { boardId: string };
};

export const BoardsStackNavigator = () => {
  useBackButtonHandler();
  return (
    <BoardsStack.Navigator screenOptions={{ headerShown: false }}>
      <BoardsStack.Screen name="BoardList" component={BoardListScreen} />
      <BoardsStack.Screen name="BoardCanvas" component={BoardCanvasScreen} />
    </BoardsStack.Navigator>
  );
};
//#endregion
//#region Sketches

const SketchStack = createNativeStackNavigator<SketchStackParamList>();

export type SketchStackParamList = {
  SketchList: undefined;
  SketchCanvas: { sketchId: string };
};

export const SketchStackNavigator = () => {
  useBackButtonHandler();
  return (
    <SketchStack.Navigator screenOptions={{ headerShown: false }}>
      <SketchStack.Screen name="SketchList" component={SketchListScreen} />
      <SketchStack.Screen name="SketchCanvas" component={SketchCanvasScreen} />
    </SketchStack.Navigator>
  );
};
//#endregion
//#region Songs

const SongStack = createNativeStackNavigator<SongStackParamList>();

export type SongStackParamList = {
  SongList: undefined;
  SongEditor: { songId: string };
};

export const SongStackNavigator = () => {
  useBackButtonHandler();
  return (
    <SongStack.Navigator screenOptions={{ headerShown: false }}>
      <SongStack.Screen name="SongList" component={SongListScreen} />
      <SongStack.Screen name="SongEditor" component={SongEditorScreen} />
    </SongStack.Navigator>
  );
};
//#endregion
//#region Tags

const TagsStack = createNativeStackNavigator<TagsStackParamList>();

export type TagsStackParamList = {
  Tags: undefined;
  TagDetail: TagDetailScreenParamList['TagDetail'];
  TagForm: { tagId?: string };
};

export const TagStackNavigator = () => {
  useBackButtonHandler();
  return (
    <TagsStack.Navigator screenOptions={{ headerShown: false }}>
      <TagsStack.Screen name="Tags" component={TagsScreen} />
      <TagsStack.Screen name="TagDetail" component={TagDetailScreen} />
      <TagsStack.Screen name="TagForm" component={TagFormScreen} />
    </TagsStack.Navigator>
  );
};
//#endregion
//#region Notes

const NotesStack = createNativeStackNavigator<NotesStackParamList>();

export type NotesStackParamList = {
  Notes: undefined;
  NoteDetail: NoteDetailScreenParamList['NoteDetail'];
  NoteForm: { noteId?: string };
};

export const NoteStackNavigator = () => {
  useBackButtonHandler();
  return (
    <NotesStack.Navigator screenOptions={{ headerShown: false }}>
      <NotesStack.Screen name="Notes" component={NotesScreen} />
      <NotesStack.Screen name="NoteDetail" component={NoteDetailScreen} />
      <NotesStack.Screen name="NoteForm" component={NoteFormScreen} />
    </NotesStack.Navigator>
  );
};
//#endregion
//#region WorldRules

const WorldRulesStack = createNativeStackNavigator<WorldRulesStackParamList>();

export type WorldRulesStackParamList = {
  WorldRules:
    | { section?: import('@keres/shared/entities/WorldRule').WorldPieceSection }
    | undefined;
  WorldRuleDetail: WorldRuleDetailScreenParamList['WorldRuleDetail'];
  WorldRuleForm: { worldRuleId?: string };
};

export const WorldRuleStackNavigator = () => {
  useBackButtonHandler();
  return (
    <WorldRulesStack.Navigator screenOptions={{ headerShown: false }}>
      <WorldRulesStack.Screen name="WorldRules" component={WorldRulesScreen} />
      <WorldRulesStack.Screen name="WorldRuleDetail" component={WorldRuleDetailScreen} />
      <WorldRulesStack.Screen name="WorldRuleForm" component={WorldRuleFormScreen} />
    </WorldRulesStack.Navigator>
  );
};
//#endregion
//#region Operationlog
const OperationLogStack = createNativeStackNavigator<OperationLogStackParamList>();

export type OperationLogStackParamList = {
  OperationLog: undefined;
  OperationLogDetail: { logId: string };
};

export const OperationLogStackNavigator = () => {
  useBackButtonHandler();
  return (
    <OperationLogStack.Navigator screenOptions={{ headerShown: false }}>
      <OperationLogStack.Screen name="OperationLog" component={OperationLogScreen} />
      <OperationLogStack.Screen name="OperationLogDetail" component={OperationLogDetailScreen} />
    </OperationLogStack.Navigator>
  );
};
//#endregion
//#region StoryAnalysis
const StoryAnalysisStack = createNativeStackNavigator<StoryAnalysisStackParamList>();

export type StoryAnalysisStackParamList = {
  // Optional on purpose: the dashboard passes the story explicitly, but arriving straight from the
  // drawer navigates with no param at all (both screens read `selectedStory`).
  StoryAnalysis: { storyId: string } | undefined;
  StoryEntityCount: undefined;
};

export const StoryAnalysisStackNavigator = () => {
  useBackButtonHandler();
  return (
    <StoryAnalysisStack.Navigator screenOptions={{ headerShown: false }}>
      <StoryAnalysisStack.Screen name="StoryAnalysis" component={StoryAnalysisScreen} />
      <StoryAnalysisStack.Screen name="StoryEntityCount" component={StoryEntityCountScreen} />
    </StoryAnalysisStack.Navigator>
  );
};
//#endregion
//#region Comments

const CommentsStack = createNativeStackNavigator<CommentsStackParamList>();

export type CommentsStackParamList = {
  CommentsList: undefined;
};

export const CommentsStackNavigator = () => {
  useBackButtonHandler();
  return (
    <CommentsStack.Navigator screenOptions={{ headerShown: false }}>
      <CommentsStack.Screen name="CommentsList" component={CommentListScreen} />
    </CommentsStack.Navigator>
  );
};
//#endregion
