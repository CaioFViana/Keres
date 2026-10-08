import { drawerAnchorId, screenAnchorId } from './anchorRegistry';
import { entityListGuides } from './entityListGuides';
import { songGuides } from './songGuides';
import { writingGuides } from './writingGuides';
import type { Guide, GuideDrawerId } from './types';
import { isServerless } from '../utils/clientFlavor';

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
 * hook fires for drawer roots and inner screens alike. Canvas screens (BoardCanvas,
 * SketchCanvas, LocationMap) tour their chrome instead of their content: document actions, the add
 * group, then the mode toggles and how they switch each other off.
 */
export const screenGuides: Record<string, Guide> = {
  ...songGuides,
  ...entityListGuides,
  ...writingGuides,
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
      // A serverless build has no servers, friends or publishing to walk through.
      ...(isServerless()
        ? []
        : [
            {
              id: 'drawer-servers',
              drawerId: 'story-selection' as const,
              anchors: drawerGroup('story-selection', [
                'ServerManagementDrawer',
                'FriendshipDrawer',
                'ImportExport',
                'PublishStory',
              ]),
              titleKey: 'tour_selection_group_servers_title',
              bodyKey: 'tour_selection_group_servers_body',
            },
          ]),
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
  StoryEntityCount: {
    id: 'StoryEntityCount',
    drawerId: 'main-system',
    helpPageId: 'story-analysis',
    steps: [
      {
        id: 'card',
        anchors: [screenAnchorId('StoryEntityCount', 'card')],
        titleKey: 'tour_entitycount_start_title',
        bodyKey: 'tour_entitycount_start_body',
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
  MessageInbox: {
    id: 'MessageInbox',
    drawerId: 'story-selection',
    helpPageId: 'messages',
    steps: [
      {
        id: 'list',
        anchors: [screenAnchorId('Messages', 'list')],
        titleKey: 'tour_messages_list_title',
        bodyKey: 'tour_messages_list_body',
      },
    ],
  },
  BoardCanvas: {
    id: 'BoardCanvas',
    drawerId: 'main-system',
    helpPageId: 'boards',
    steps: [
      {
        id: 'document',
        anchors: [screenAnchorId('BoardCanvas', 'document')],
        titleKey: 'tour_boardcanvas_document_title',
        bodyKey: 'tour_boardcanvas_document_body',
      },
      {
        id: 'add',
        anchors: [screenAnchorId('BoardCanvas', 'add')],
        titleKey: 'tour_boardcanvas_add_title',
        bodyKey: 'tour_boardcanvas_add_body',
      },
      {
        id: 'modes',
        anchors: [screenAnchorId('BoardCanvas', 'modes')],
        titleKey: 'tour_boardcanvas_modes_title',
        bodyKey: 'tour_boardcanvas_modes_body',
      },
    ],
  },
  SketchCanvas: {
    id: 'SketchCanvas',
    drawerId: 'main-system',
    helpPageId: 'sketch',
    steps: [
      {
        id: 'document',
        anchors: [screenAnchorId('SketchCanvas', 'document')],
        titleKey: 'tour_sketchcanvas_document_title',
        bodyKey: 'tour_sketchcanvas_document_body',
      },
      {
        id: 'add',
        anchors: [screenAnchorId('SketchCanvas', 'tools')],
        titleKey: 'tour_sketchcanvas_add_title',
        bodyKey: 'tour_sketchcanvas_add_body',
      },
    ],
  },
  LocationMap: {
    id: 'LocationMap',
    drawerId: 'main-system',
    helpPageId: 'location-map',
    steps: [
      {
        id: 'document',
        anchors: [screenAnchorId('LocationMap', 'document')],
        titleKey: 'tour_locationmap_document_title',
        bodyKey: 'tour_locationmap_document_body',
      },
      {
        id: 'add',
        anchors: [screenAnchorId('LocationMap', 'add')],
        titleKey: 'tour_locationmap_add_title',
        bodyKey: 'tour_locationmap_add_body',
      },
      {
        id: 'modes',
        anchors: [screenAnchorId('LocationMap', 'modes')],
        titleKey: 'tour_locationmap_modes_title',
        bodyKey: 'tour_locationmap_modes_body',
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
        anchors: [
          screenAnchorId('MainDashboard', 'works'),
          screenAnchorId('MainDashboard', 'overview'),
        ],
        titleKey: 'tour_dashboard_start_title',
        bodyKey: 'tour_dashboard_start_body',
      },
      {
        id: 'writing',
        anchors: [screenAnchorId('MainDashboard', 'writing')],
        titleKey: 'tour_dashboard_writing_title',
        bodyKey: 'tour_dashboard_writing_body',
      },
      {
        id: 'drawer-groups',
        drawerId: 'main-system',
        anchors: drawerGroup('main-system', [
          'group:write',
          'group:components',
          'group:world',
          'group:material',
          'group:review',
        ]),
        titleKey: 'tour_dashboard_groups_title',
        bodyKey: 'tour_dashboard_groups_body',
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
