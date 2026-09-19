import { drawerAnchorId, screenAnchorId } from './anchorRegistry';
import type { Guide, GuideDrawerId } from './types';

const drawerGroup = (drawerId: GuideDrawerId, routes: readonly string[]): string[] =>
  routes.map((route) => drawerAnchorId(drawerId, route));

/**
 * The tour per screen, keyed by route name (the same vocabulary as `screenHelpPage`). Screens
 * without an entry show no tour.
 *
 * Pilot: story selection, story creation and the dashboard. Every guide keeps the article's
 * rules: at most 4 steps, one idea per step, benefits over feature lists, and a drawer finale
 * in semantic groups - never item by item.
 *
 * Wave 2 (Characters, NarrativeElements, Items, GlobalSearch, PackList) is screen-only on
 * purpose: the dashboard tour already walked the main drawer, and repeating its groups on
 * every screen would be the chain of tips the article warns about.
 */
export const screenGuides: Record<string, Guide> = {
  StorySelectionMain: {
    id: 'StorySelectionMain',
    drawerId: 'story-selection',
    helpPageId: 'story-list',
    steps: [
      {
        id: 'stories',
        anchors: [screenAnchorId('StorySelection', 'list')],
        titleKey: 'tour_selection_start_title',
        bodyKey: 'tour_selection_start_body',
      },
      {
        id: 'drawer-create',
        drawerId: 'story-selection',
        anchors: drawerGroup('story-selection', ['PacksDrawer', 'ExampleStories']),
        titleKey: 'tour_selection_group_create_title',
        bodyKey: 'tour_selection_group_create_body',
      },
      {
        id: 'drawer-servers',
        drawerId: 'story-selection',
        anchors: drawerGroup('story-selection', [
          'ServerManagementDrawer',
          'FriendshipDrawer',
          'ImportExport',
          'PublishStory',
        ]),
        titleKey: 'tour_selection_group_servers_title',
        bodyKey: 'tour_selection_group_servers_body',
      },
      {
        id: 'drawer-system',
        drawerId: 'story-selection',
        anchors: drawerGroup('story-selection', ['StoryDevicesDrawer', 'HelpDrawer', 'Settings']),
        titleKey: 'tour_selection_group_system_title',
        bodyKey: 'tour_selection_group_system_body',
      },
    ],
  },
  ExampleStories: {
    id: 'ExampleStories',
    drawerId: 'story-selection',
    helpPageId: 'example-stories',
    steps: [
      {
        id: 'install',
        anchors: [screenAnchorId('ExampleStories', 'list')],
        titleKey: 'tour_examplestories_install_title',
        bodyKey: 'tour_examplestories_install_body',
      },
    ],
  },
  StoryForm: {
    id: 'StoryForm',
    drawerId: 'story-selection',
    helpPageId: 'create-story',
    steps: [
      {
        id: 'packs',
        anchors: [screenAnchorId('StoryForm', 'packs')],
        titleKey: 'tour_storyform_packs_title',
        bodyKey: 'tour_storyform_packs_body',
      },
      {
        id: 'extras',
        anchors: [screenAnchorId('StoryForm', 'extras')],
        titleKey: 'tour_storyform_extras_title',
        bodyKey: 'tour_storyform_extras_body',
      },
    ],
  },
  CharactersStack: {
    id: 'CharactersStack',
    drawerId: 'main-system',
    helpPageId: 'characters',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('Characters', 'list')],
        titleKey: 'tour_characters_start_title',
        bodyKey: 'tour_characters_start_body',
      },
    ],
  },
  NarrativeElementsStack: {
    id: 'NarrativeElementsStack',
    drawerId: 'main-system',
    helpPageId: 'narrative-elements',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('NarrativeElements', 'list')],
        titleKey: 'tour_narrative_start_title',
        bodyKey: 'tour_narrative_start_body',
      },
    ],
  },
  ItemsStack: {
    id: 'ItemsStack',
    drawerId: 'main-system',
    helpPageId: 'items',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('Items', 'list')],
        titleKey: 'tour_items_start_title',
        bodyKey: 'tour_items_start_body',
      },
    ],
  },
  GlobalSearch: {
    id: 'GlobalSearch',
    drawerId: 'main-system',
    helpPageId: 'lists-and-search',
    steps: [
      {
        id: 'search',
        anchors: [screenAnchorId('GlobalSearch', 'search')],
        titleKey: 'tour_search_start_title',
        bodyKey: 'tour_search_start_body',
      },
    ],
  },
  PackList: {
    id: 'PackList',
    drawerId: 'story-selection',
    helpPageId: 'packs',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('Packs', 'list')],
        titleKey: 'tour_packs_list_title',
        bodyKey: 'tour_packs_list_body',
      },
      {
        id: 'actions',
        anchors: [screenAnchorId('Packs', 'actions')],
        titleKey: 'tour_packs_create_title',
        bodyKey: 'tour_packs_create_body',
      },
    ],
  },
  MainDashboard: {
    id: 'MainDashboard',
    drawerId: 'main-system',
    helpPageId: 'story-dashboard',
    steps: [
      {
        id: 'overview',
        anchors: [screenAnchorId('MainDashboard', 'overview')],
        titleKey: 'tour_dashboard_start_title',
        bodyKey: 'tour_dashboard_start_body',
      },
      {
        id: 'drawer-entities',
        drawerId: 'main-system',
        anchors: drawerGroup('main-system', [
          'CharactersStack',
          'NarrativeElementsStack',
          'PlotsStack',
          'LocationsStack',
          'ItemsStack',
          'TagsStack',
          'WorldRulesStack',
          'NotesStack',
          'GalleryStack',
          'BoardsStack',
        ]),
        titleKey: 'tour_dashboard_group_entities_title',
        bodyKey: 'tour_dashboard_group_entities_body',
      },
      {
        id: 'drawer-organize',
        drawerId: 'main-system',
        anchors: drawerGroup('main-system', [
          'CustomizationStack',
          'CommentsStack',
          'OperationLogStack',
          'StoryAnalysis',
        ]),
        titleKey: 'tour_dashboard_group_organize_title',
        bodyKey: 'tour_dashboard_group_organize_body',
      },
      {
        id: 'drawer-system',
        drawerId: 'main-system',
        anchors: drawerGroup('main-system', ['HelpDrawer', 'StorySettings', 'StorySelection']),
        titleKey: 'tour_dashboard_group_system_title',
        bodyKey: 'tour_dashboard_group_system_body',
      },
    ],
  },
};

export function getScreenGuide(screenId: string): Guide | undefined {
  return screenGuides[screenId];
}
