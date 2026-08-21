/**
 * Inventário da landing. Os textos moram nos dicionários; daqui saem só os ids,
 * para a página e os testes afirmarem a mesma lista.
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
      'items',
      'itemJourneys',
      'worldRules',
      'notes',
      'tags',
      'gallery',
      'favorites',
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

export const DOWNLOADS = ['releases', 'server', 'docker', 'source'] as const;

export const FAQ_ITEMS = [
  'editor',
  'offline',
  'server',
  'languages',
  'collaborate',
  'cost',
  'showcase',
] as const;

export type FeatureGroupId = (typeof FEATURE_GROUPS)[number]['id'];
