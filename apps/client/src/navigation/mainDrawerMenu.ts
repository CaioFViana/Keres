import type { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance } from '@keres/shared';
import type { WorldPieceSection } from '@keres/shared/entities/WorldRule';
import type { MainSystemDrawerParamList } from './MainSystemStack';

type IconName = keyof typeof Ionicons.glyphMap;

/** Where the focused drawer entry's own navigator is: its screen name and that screen's params. */
export interface NestedFocus {
  screen?: string;
  params?: Record<string, unknown>;
}

export interface MenuLeaf {
  /** The tour anchor and test id: the route name, unless several entries share one route. */
  id: string;
  route: keyof MainSystemDrawerParamList;
  label: string;
  icon: IconName;
  /**
   * Opens this screen as the stack's only one, so back and the menu behave the same whatever the stack held
   * before. Absent: the stack's list screen, through the drawer entry's own press listener.
   */
  target?: { screen: string; params?: object };
  /** Whether this entry is the one on screen, given where its route's navigator is. */
  active?: (focus: NestedFocus) => boolean;
}

export type MenuGroupId = 'write' | 'components' | 'world' | 'material' | 'review';

export interface MenuGroup {
  id: MenuGroupId;
  labelKey: string;
  leaves: MenuLeaf[];
  /** Open on a fresh start; the group with the screen on show opens regardless. */
  defaultOpen: boolean;
}

export interface MainDrawerMenuModel {
  groups: MenuGroup[];
  footer: MenuLeaf[];
}

/** The order the world's categories are offered in. "Other" stays inside "All". */
const WORLD_SECTIONS: readonly WorldPieceSection[] = [
  'rule',
  'people',
  'mythology',
  'knowledge',
  'fauna',
  'flora',
];

const WORLD_SECTION_ICONS: Record<WorldPieceSection, IconName> = {
  rule: 'shield-checkmark-outline',
  people: 'people-outline',
  mythology: 'sparkles-outline',
  knowledge: 'library-outline',
  fauna: 'paw-outline',
  flora: 'leaf-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

/** The manuscript lives in the narrative stack, beside the chapter list that feeds it. */
const MANUSCRIPT_SCREENS = new Set(['Manuscript', 'ManuscriptExport']);

const appearanceIcon = (entity: Parameters<typeof getEntityAppearance>[0]) =>
  getEntityAppearance(entity).icon as IconName;

export interface MainDrawerMenuInput {
  t: (key: string) => string;
  term: (key: 'Character' | 'Location' | 'Item', plural: boolean) => string;
  showLiteraryDevices: boolean;
}

export function buildMainDrawerMenu({
  t,
  term,
  showLiteraryDevices,
}: MainDrawerMenuInput): MainDrawerMenuModel {
  const groups: MenuGroup[] = [
    {
      id: 'write',
      labelKey: 'drawer_group_write',
      defaultOpen: true,
      leaves: [
        {
          id: 'MainDashboard',
          route: 'MainDashboard',
          label: t('dashboard_title'),
          icon: 'grid-outline',
        },
        {
          id: 'NarrativeElementsStack',
          route: 'NarrativeElementsStack',
          label: t('narrative_elements_title'),
          icon: 'documents-outline',
          target: { screen: 'NarrativeElements' },
          active: (focus) => !MANUSCRIPT_SCREENS.has(focus.screen ?? ''),
        },
        {
          id: 'Manuscript',
          route: 'NarrativeElementsStack',
          label: t('manuscript_title'),
          icon: 'book-outline',
          target: { screen: 'Manuscript' },
          active: (focus) => MANUSCRIPT_SCREENS.has(focus.screen ?? ''),
        },
      ],
    },
    {
      id: 'components',
      labelKey: 'drawer_group_components',
      defaultOpen: true,
      leaves: [
        {
          id: 'CharactersStack',
          route: 'CharactersStack',
          label: term('Character', true),
          icon: 'people-outline',
        },
        {
          id: 'LocationsStack',
          route: 'LocationsStack',
          label: term('Location', true),
          icon: 'map-outline',
        },
        { id: 'ItemsStack', route: 'ItemsStack', label: term('Item', true), icon: 'cube-outline' },
        {
          id: 'PlotsStack',
          route: 'PlotsStack',
          label: t('plots_title'),
          icon: 'git-branch-outline',
        },
        {
          id: 'StatsStack',
          route: 'StatsStack',
          label: t('stats_title'),
          icon: 'stats-chart-outline',
        },
      ],
    },
    {
      id: 'world',
      labelKey: 'drawer_group_world',
      defaultOpen: false,
      leaves: [
        {
          id: 'WorldRulesStack',
          route: 'WorldRulesStack',
          label: t('drawer_world_all'),
          icon: 'apps-outline',
          target: { screen: 'WorldRules' },
          // Anything that is not one category's list (a piece's page, say) belongs to "all".
          active: (focus) => focus.screen !== 'WorldRules' || !focus.params?.section,
        },
        ...WORLD_SECTIONS.map(
          (section): MenuLeaf => ({
            id: `WorldRulesStack:${section}`,
            route: 'WorldRulesStack',
            label: t(`world_piece_section_${section}`),
            icon: WORLD_SECTION_ICONS[section],
            target: { screen: 'WorldRules', params: { section } },
            active: (focus) => focus.screen === 'WorldRules' && focus.params?.section === section,
          }),
        ),
        {
          id: 'CalendarsStack',
          route: 'CalendarsStack',
          label: t('calendar_list_title'),
          icon: 'calendar-outline',
        },
      ],
    },
    {
      id: 'material',
      labelKey: 'drawer_group_material',
      defaultOpen: true,
      leaves: [
        { id: 'GalleryStack', route: 'GalleryStack', label: t('gallery_title'), icon: 'images-outline' },
        {
          id: 'BoardsStack',
          route: 'BoardsStack',
          label: t('boards_title'),
          icon: appearanceIcon('Board'),
        },
        {
          id: 'SketchStack',
          route: 'SketchStack',
          label: t('sketches_title'),
          icon: appearanceIcon('Sketch'),
        },
        {
          id: 'SongStack',
          route: 'SongStack',
          label: t('songs_title'),
          icon: appearanceIcon('Song'),
        },
      ],
    },
    {
      id: 'review',
      labelKey: 'drawer_group_review',
      defaultOpen: false,
      leaves: [
        {
          id: 'GlobalSearch',
          route: 'GlobalSearch',
          label: t('global_search_title'),
          icon: 'search-outline',
        },
        { id: 'NotesStack', route: 'NotesStack', label: t('notes_title'), icon: 'document-text-outline' },
        { id: 'TagsStack', route: 'TagsStack', label: t('tags_title'), icon: 'pricetag-outline' },
        {
          id: 'StoryAnalysisStack',
          route: 'StoryAnalysisStack',
          label: t('story_analysis_title'),
          icon: 'analytics-outline',
        },
        {
          id: 'CommentsStack',
          route: 'CommentsStack',
          label: t('comments_title'),
          icon: 'chatbubbles-outline',
        },
        {
          id: 'OperationLogStack',
          route: 'OperationLogStack',
          label: t('operation_logs_title'),
          icon: 'time-outline',
        },
        ...(showLiteraryDevices
          ? [
              {
                id: 'StoryDevicesDrawer',
                route: 'StoryDevicesDrawer',
                label: t('story_devices_title'),
                icon: 'bulb-outline',
              } satisfies MenuLeaf,
            ]
          : []),
      ],
    },
  ];

  const footer: MenuLeaf[] = [
    {
      id: 'StorySettings',
      route: 'StorySettings',
      label: t('story_settings_title'),
      icon: 'settings-outline',
    },
    { id: 'HelpDrawer', route: 'HelpDrawer', label: t('help_title'), icon: 'help-circle-outline' },
    {
      id: 'StorySelection',
      route: 'StorySelection',
      label: t('story_selection_title'),
      icon: 'exit-outline',
    },
  ];

  return { groups, footer };
}

/** Whether `leaf` is the entry on screen. Entries without a rule are on screen whenever their route is. */
export function isLeafActive(leaf: MenuLeaf, focusedRoute: string, focus: NestedFocus): boolean {
  if (leaf.route !== focusedRoute) return false;
  return leaf.active ? leaf.active(focus) : true;
}
