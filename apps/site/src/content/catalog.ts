/**
 * The landing page's inventory. The texts live in the dictionaries; only the ids
 * come from here, so the page and the tests assert the same list.
 */

export const NAV_SECTIONS = ['product', 'universe', 'platforms', 'download'] as const;

export const PILLARS = ['offline', 'universe', 'anywhere'] as const;

export const FEATURE_GROUPS = [
  {
    id: 'universe',
    items: [
      'characters',
      'relations',
      'modes',
      'stats',
      'chapters',
      'scenes',
      'timing',
      'locations',
      'locationMap',
      'locationMapCanvas',
      'items',
      'itemJourneys',
      'worldRules',
      'notes',
      'tags',
      'gallery',
      'favorites',
      'boards',
    ],
  },
  {
    id: 'branching',
    items: ['type', 'choices', 'storyMap', 'conditions', 'effects', 'storyState'],
  },
  {
    id: 'craft',
    items: [
      'customAttributes',
      'suggestions',
      'search',
      'analysis',
      'dashboard',
      'comments',
      'seeAlso',
      'storyDevices',
      'help',
      'exampleStories',
    ],
  },
  {
    id: 'together',
    items: [
      'offlineSync',
      'servers',
      'friends',
      'collaborators',
      'conflicts',
      'activityLog',
      'publish',
      'importExport',
    ],
  },
] as const;

export const PLATFORMS = [
  'android',
  'ios',
  'web',
  'windows',
  'macos',
  'linux',
  'keresServer',
  'docker',
] as const;

/**
 * The showcase: photos of the app running, not drawings made for the page.
 *
 * Each file in `public/showcase/screens/<id>.<language>.<theme>.png` comes from
 * `apps/desktop/scripts/capture-screens.cjs`, which opens the real app inside Electron,
 * with an example story installed, and photographs the screen. There is one version per
 * language and theme, and each screen comes from the example story that fills it best -
 * the whole showcase taken from a single example gave the impression of a one-story app.
 *
 * The list is short on purpose: account, server, and import screens show plumbing, not
 * writing - they remain text on the feature cards.
 */
export const SHOWCASE_SCREENS = [
  { id: 'narrative-elements', width: 1440, height: 900 },
  { id: 'dashboard', width: 1440, height: 900 },
  { id: 'character-list', width: 1440, height: 900 },
  { id: 'character-detail', width: 1440, height: 900 },
  { id: 'relation-map', width: 1440, height: 900 },
  { id: 'story-map', width: 1440, height: 900 },
  { id: 'board-canvas', width: 1440, height: 900 },
  { id: 'story-timeline', width: 1440, height: 900 },
  // The location map is a low strip: photographed in the full window, it left half a page
  // of white below the drawing.
  { id: 'location-map', width: 1440, height: 560 },
  { id: 'location-map-canvas', width: 1440, height: 900 },
  { id: 'plot-coverage', width: 1440, height: 620 },
  { id: 'plot-matrix', width: 1440, height: 900 },
] as const;

export type ShowcaseScreenId = (typeof SHOWCASE_SCREENS)[number]['id'];

export const DOWNLOADS = ['releases', 'server', 'docker', 'source'] as const;

export const FAQ_ITEMS = [
  'editor',
  'browser',
  'offline',
  'server',
  'languages',
  'collaborate',
  'cost',
  'showcase',
] as const;

export type FeatureGroupId = (typeof FEATURE_GROUPS)[number]['id'];
