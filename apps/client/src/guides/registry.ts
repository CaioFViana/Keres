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
 * every screen would be the chain of tips the article warns about. Wave 3 extends the same
 * screen-only pattern to the rest of the story drawer, so every drawer destination owns a
 * first-open tour; system entries (ArcContext, Help, Settings, Selection) stay quiet.
 * Nested routes own tours the same way once they matter enough (Manuscript): the focus
 * hook fires for drawer roots and inner screens alike.
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
  Manuscript: {
    id: 'Manuscript',
    drawerId: 'main-system',
    helpPageId: 'manuscript',
    steps: [
      {
        id: 'read',
        anchors: [screenAnchorId('Manuscript', 'list')],
        titleKey: 'tour_manuscript_read_title',
        bodyKey: 'tour_manuscript_read_body',
      },
      {
        id: 'search',
        anchors: [screenAnchorId('Manuscript', 'search')],
        titleKey: 'tour_manuscript_search_title',
        bodyKey: 'tour_manuscript_search_body',
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
  PlotsStack: {
    id: 'PlotsStack',
    drawerId: 'main-system',
    helpPageId: 'plots',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('Plots', 'list')],
        titleKey: 'tour_plots_start_title',
        bodyKey: 'tour_plots_start_body',
      },
    ],
  },
  LocationsStack: {
    id: 'LocationsStack',
    drawerId: 'main-system',
    helpPageId: 'locations',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('Locations', 'list')],
        titleKey: 'tour_locations_start_title',
        bodyKey: 'tour_locations_start_body',
      },
    ],
  },
  TagsStack: {
    id: 'TagsStack',
    drawerId: 'main-system',
    helpPageId: 'tags',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('Tags', 'list')],
        titleKey: 'tour_tags_start_title',
        bodyKey: 'tour_tags_start_body',
      },
    ],
  },
  WorldRulesStack: {
    id: 'WorldRulesStack',
    drawerId: 'main-system',
    helpPageId: 'world-rules',
    steps: [
      {
        id: 'sections',
        anchors: [screenAnchorId('WorldIndex', 'sections')],
        titleKey: 'tour_world_start_title',
        bodyKey: 'tour_world_start_body',
      },
    ],
  },
  NotesStack: {
    id: 'NotesStack',
    drawerId: 'main-system',
    helpPageId: 'notes',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('Notes', 'list')],
        titleKey: 'tour_notes_start_title',
        bodyKey: 'tour_notes_start_body',
      },
    ],
  },
  GalleryStack: {
    id: 'GalleryStack',
    drawerId: 'main-system',
    helpPageId: 'gallery',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('Gallery', 'list')],
        titleKey: 'tour_gallery_start_title',
        bodyKey: 'tour_gallery_start_body',
      },
    ],
  },
  BoardsStack: {
    id: 'BoardsStack',
    drawerId: 'main-system',
    helpPageId: 'boards',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('Boards', 'list')],
        titleKey: 'tour_boards_start_title',
        bodyKey: 'tour_boards_start_body',
      },
    ],
  },
  CustomizationStack: {
    id: 'CustomizationStack',
    drawerId: 'main-system',
    helpPageId: 'custom-attributes',
    steps: [
      {
        id: 'index',
        anchors: [screenAnchorId('Customization', 'index')],
        titleKey: 'tour_customization_start_title',
        bodyKey: 'tour_customization_start_body',
      },
    ],
  },
  CommentsStack: {
    id: 'CommentsStack',
    drawerId: 'main-system',
    helpPageId: 'comments',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('Comments', 'list')],
        titleKey: 'tour_comments_start_title',
        bodyKey: 'tour_comments_start_body',
      },
    ],
  },
  OperationLogStack: {
    id: 'OperationLogStack',
    drawerId: 'main-system',
    helpPageId: 'activity-log',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('OperationLog', 'list')],
        titleKey: 'tour_oplog_start_title',
        bodyKey: 'tour_oplog_start_body',
      },
    ],
  },
  StoryAnalysis: {
    id: 'StoryAnalysis',
    drawerId: 'main-system',
    helpPageId: 'story-analysis',
    steps: [
      {
        id: 'report',
        anchors: [screenAnchorId('StoryAnalysis', 'report')],
        titleKey: 'tour_analysis_start_title',
        bodyKey: 'tour_analysis_start_body',
      },
    ],
  },
  StoryAppearance: {
    id: 'StoryAppearance',
    drawerId: 'main-system',
    helpPageId: 'appearance',
    steps: [
      {
        id: 'card',
        anchors: [screenAnchorId('Appearance', 'card')],
        titleKey: 'tour_appearance_start_title',
        bodyKey: 'tour_appearance_start_body',
      },
    ],
  },
  StoryArcList: {
    id: 'StoryArcList',
    drawerId: 'main-system',
    helpPageId: 'arcs',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('StoryArcs', 'list')],
        titleKey: 'tour_arcs_start_title',
        bodyKey: 'tour_arcs_start_body',
      },
    ],
  },
  Vocabulary: {
    id: 'Vocabulary',
    drawerId: 'main-system',
    helpPageId: 'vocabulary',
    steps: [
      {
        id: 'terms',
        anchors: [screenAnchorId('Vocabulary', 'terms')],
        titleKey: 'tour_vocabulary_start_title',
        bodyKey: 'tour_vocabulary_start_body',
      },
    ],
  },
  StoryCalendarList: {
    id: 'StoryCalendarList',
    drawerId: 'main-system',
    helpPageId: 'calendars',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('StoryCalendars', 'list')],
        titleKey: 'tour_calendars_start_title',
        bodyKey: 'tour_calendars_start_body',
      },
    ],
  },
  StorySchemaList: {
    id: 'StorySchemaList',
    drawerId: 'main-system',
    helpPageId: 'custom-attributes',
    steps: [
      {
        id: 'tabs',
        anchors: [screenAnchorId('StorySchema', 'tabs')],
        titleKey: 'tour_schema_tabs_title',
        bodyKey: 'tour_schema_tabs_body',
      },
      {
        id: 'fields',
        anchors: [screenAnchorId('StorySchema', 'fields')],
        titleKey: 'tour_schema_fields_title',
        bodyKey: 'tour_schema_fields_body',
      },
    ],
  },
  Suggestions: {
    id: 'Suggestions',
    drawerId: 'main-system',
    helpPageId: 'suggestions',
    steps: [
      {
        id: 'groups',
        anchors: [screenAnchorId('Suggestions', 'groups')],
        titleKey: 'tour_suggestions_start_title',
        bodyKey: 'tour_suggestions_start_body',
      },
    ],
  },
  StatList: {
    id: 'StatList',
    drawerId: 'main-system',
    helpPageId: 'stats',
    steps: [
      {
        id: 'settings',
        anchors: [screenAnchorId('Stats', 'settings')],
        titleKey: 'tour_stats_setup_title',
        bodyKey: 'tour_stats_setup_body',
      },
      {
        id: 'axes',
        anchors: [screenAnchorId('Stats', 'axes')],
        titleKey: 'tour_stats_axes_title',
        bodyKey: 'tour_stats_axes_body',
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
        anchors: drawerGroup('main-system', [
          'StoryDevicesDrawer',
          'HelpDrawer',
          'StorySettings',
          'StorySelection',
        ]),
        titleKey: 'tour_dashboard_group_system_title',
        bodyKey: 'tour_dashboard_group_system_body',
      },
    ],
  },
};

export function getScreenGuide(screenId: string): Guide | undefined {
  return screenGuides[screenId];
}
