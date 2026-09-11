import type { WorldPieceSection } from '../entities/WorldRule';

/** Theme-aware visual vocabulary shared by every entity surface. */
export const ENTITY_APPEARANCE = {
  Story: { icon: 'book', light: '#512DA8', dark: '#9575CD' },
  User: { icon: 'person', light: '#455A64', dark: '#90A4AE' },
  OperationLog: { icon: 'receipt', light: '#546E7A', dark: '#90A4AE' },
  Chapter: { icon: 'bookmarks', light: '#C62828', dark: '#F44336' },
  ChapterAnchor: { icon: 'pin', light: '#6A1B9A', dark: '#AB47BC' },
  StoryCalendar: { icon: 'calendar', light: '#1565C0', dark: '#64B5F6' },
  StoryArc: { icon: 'library', light: '#6A1B9A', dark: '#CE93D8' },
  Event: { icon: 'flag', light: '#3949AB', dark: '#5C6BC0' },
  Scene: { icon: 'easel', light: '#7B1FA2', dark: '#BA68C8' },
  Location: { icon: 'map', light: '#558B2F', dark: '#8BC34A' },
  Character: { icon: 'people', light: '#00897B', dark: '#37AFA5' },
  Note: { icon: 'document', light: '#F9A825', dark: '#FFEB3B' },
  WorldRule: { icon: 'globe', light: '#0288D1', dark: '#03A9F4' },
  Item: { icon: 'cube', light: '#6D4C41', dark: '#A1887F' },
  Gallery: { icon: 'images', light: '#00897B', dark: '#009688' },
  Tag: { icon: 'pricetag', light: '#C2185B', dark: '#E91E63' },
  StorySchemaField: { icon: 'options', light: '#5E35B1', dark: '#9575CD' },
  Choice: { icon: 'shuffle', light: '#EF6C00', dark: '#FF9800' },
  ChoiceCheckGroup: { icon: 'list', light: '#455A64', dark: '#90A4AE' },
  ChoiceCheck: { icon: 'checkbox', light: '#2E7D32', dark: '#81C784' },
  Effect: { icon: 'flash', light: '#D84315', dark: '#FF8A65' },
  Fork: { icon: 'git-branch', light: '#B8860B', dark: '#FFD700' },
  Plot: { icon: 'git-branch', light: '#B8860B', dark: '#FFD700' },
  Route: { icon: 'git-branch', light: '#B8860B', dark: '#FFD700' },
  RouteStep: { icon: 'footsteps', light: '#00838F', dark: '#4DD0E1' },
  Board: { icon: 'albums', light: '#2F4F6F', dark: '#3D5A80' },
  LocationMap: { icon: 'map-outline', light: '#00695C', dark: '#26A69A' },
  ItemJourney: { icon: 'walk', light: '#7C4DFF', dark: '#B388FF' },
  AttributeValue: { icon: 'options', light: '#5E35B1', dark: '#9575CD' },
  Favorite: { icon: 'star', light: '#F57C00', dark: '#FFB74D' },
  Suggestion: { icon: 'bulb', light: '#F9A825', dark: '#FFEB3B' },
  Comment: { icon: 'chatbubble', light: '#0277BD', dark: '#4FC3F7' },
  Stat: { icon: 'bar-chart', light: '#1565C0', dark: '#64B5F6' },
  StatStrength: { icon: 'trending-up', light: '#00897B', dark: '#4DB6AC' },
  Mode: { icon: 'toggle', light: '#AD1457', dark: '#F06292' },
} as const;

export type EntityAppearanceKey = keyof typeof ENTITY_APPEARANCE;
export type EntityAppearance = { readonly color: string; readonly icon: string };
export type EntityAppearanceScheme = 'light' | 'dark';
const FALLBACK: EntityAppearance = { color: '#607D8B', icon: 'ellipse' };
let activeScheme: EntityAppearanceScheme = 'light';

/** Set once by the host theme provider so utility code (SVG/maps) resolves the same palette as React. */
export function setEntityAppearanceScheme(isDarkMode: boolean): void {
  activeScheme = isDarkMode ? 'dark' : 'light';
}

export function getEntityAppearance(entityType: string, isDarkMode?: boolean): EntityAppearance {
  const appearance = ENTITY_APPEARANCE[entityType as EntityAppearanceKey];
  const scheme = isDarkMode === undefined ? activeScheme : isDarkMode ? 'dark' : 'light';
  return appearance ? { icon: appearance.icon, color: appearance[scheme] } : FALLBACK;
}

export const WORLD_PIECE_SECTION_APPEARANCE: Record<
  WorldPieceSection,
  { icon: string; light: string; dark: string }
> = {
  rule: { icon: 'shield-checkmark-outline', light: '#0277BD', dark: '#0288D1' },
  fauna: { icon: 'paw-outline', light: '#C62828', dark: '#EF5350' },
  flora: { icon: 'leaf-outline', light: '#2E7D32', dark: '#2E7D32' },
  mythology: { icon: 'sparkles-outline', light: '#5E35B1', dark: '#7E57C2' },
  people: { icon: 'people-outline', light: '#C17900', dark: '#F9A825' },
  knowledge: { icon: 'library-outline', light: '#455A64', dark: '#546E7A' },
  other: { icon: 'ellipsis-horizontal-circle-outline', light: '#607D8B', dark: '#78909C' },
};

export function getWorldPieceSectionAppearance(
  section: WorldPieceSection,
  isDarkMode?: boolean,
): EntityAppearance {
  const appearance = WORLD_PIECE_SECTION_APPEARANCE[section];
  const scheme = isDarkMode === undefined ? activeScheme : isDarkMode ? 'dark' : 'light';
  return { icon: appearance.icon, color: appearance[scheme] };
}
