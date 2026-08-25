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

/**
 * A vitrine: fotos do app rodando, não desenhos feitos para a página.
 *
 * Cada arquivo em `public/showcase/screens/<id>.<idioma>.<tema>.png` sai de
 * `apps/desktop/scripts/capture-screens.cjs`, que abre o app de verdade dentro do Electron,
 * com uma história de exemplo instalada, e fotografa a tela. Existe uma versão por idioma e
 * por tema, e cada tela vem da história de exemplo que melhor a preenche - a vitrine inteira
 * saindo do mesmo exemplo dava a impressão de um app de uma história só.
 *
 * A lista é curta de propósito: telas de conta, servidor e importação mostram encanamento, não
 * a escrita - elas continuam sendo texto nos cartões de recurso.
 */
export const SHOWCASE_SCREENS = [
  { id: 'narrative-elements', width: 1440, height: 900 },
  { id: 'story-map', width: 1440, height: 900 },
  { id: 'story-timeline', width: 1440, height: 900 },
  { id: 'plot-matrix', width: 1440, height: 900 },
  { id: 'plot-coverage', width: 1440, height: 620 },
  { id: 'character-list', width: 1440, height: 900 },
  { id: 'relation-map', width: 1440, height: 900 },
  // O mapa de locais é uma faixa baixa: fotografado na janela cheia, sobrava meia página em
  // branco embaixo do desenho.
  { id: 'location-map', width: 1440, height: 560 },
  { id: 'dashboard', width: 1440, height: 900 },
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
