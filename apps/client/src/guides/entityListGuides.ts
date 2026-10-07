import { headerAnchorId, screenAnchorId } from './anchorRegistry';
import type { Guide, GuideStep } from './types';

interface EntityListSpec {
  /** The route name the tour belongs to, as `screenGuides` keys it. */
  id: string;
  helpPageId: string;
  /** The `GenericFilterSortList` entity name its search and controls are anchored under. */
  entity?: string;
  /** The region anchor of the list itself, as `[screen, part]`. */
  list: readonly [string, string];
  /** The prefix of the keys of the first step, which says what the list holds: `tour_<prefix>_start_*`. */
  prefix: string;
  /** Header actions worth a step of their own before the add button, by icon. */
  extra?: { id: string; icons: readonly string[]; titleKey: string; bodyKey: string };
}

/**
 * The tour of a list of entities: what it holds, how to find things in it, then how to add one. The
 * search and the controls are anchors of the shared list, the add button is the header's `add` icon,
 * so one recipe covers every list instead of ten hand-written ones that drift apart.
 */
function entityListGuide(spec: EntityListSpec): Guide {
  const steps: GuideStep[] = [
    {
      id: 'list',
      anchors: [screenAnchorId(spec.list[0], spec.list[1])],
      titleKey: `tour_${spec.prefix}_start_title`,
      bodyKey: `tour_${spec.prefix}_start_body`,
    },
  ];
  if (spec.entity) {
    steps.push({
      id: 'find',
      anchors: [screenAnchorId(spec.entity, 'search'), screenAnchorId(spec.entity, 'controls')],
      titleKey: 'tour_list_find_title',
      bodyKey: 'tour_list_find_body',
    });
  }
  if (spec.extra) {
    steps.push({
      id: spec.extra.id,
      anchors: spec.extra.icons.map(headerAnchorId),
      titleKey: spec.extra.titleKey,
      bodyKey: spec.extra.bodyKey,
    });
  }
  steps.push({
    id: 'add',
    anchors: [headerAnchorId('add')],
    titleKey: 'tour_list_add_title',
    bodyKey: 'tour_list_add_body',
  });
  return { id: spec.id, drawerId: 'main-system', helpPageId: spec.helpPageId, steps };
}

const specs: EntityListSpec[] = [
  {
    id: 'CharactersStack',
    helpPageId: 'characters',
    entity: 'Character',
    list: ['Characters', 'list'],
    prefix: 'characters',
  },
  {
    id: 'NarrativeElementsStack',
    helpPageId: 'narrative-elements',
    entity: 'Chapter',
    list: ['NarrativeElements', 'list'],
    prefix: 'narrative',
  },
  {
    id: 'ItemsStack',
    helpPageId: 'items',
    entity: 'Item',
    list: ['Items', 'list'],
    prefix: 'items',
  },
  {
    id: 'PlotsStack',
    helpPageId: 'plots',
    entity: 'Plot',
    list: ['Plots', 'list'],
    prefix: 'plots',
  },
  {
    id: 'LocationsStack',
    helpPageId: 'locations',
    entity: 'Location',
    list: ['Locations', 'list'],
    prefix: 'locations',
  },
  { id: 'TagsStack', helpPageId: 'tags', entity: 'Tag', list: ['Tags', 'list'], prefix: 'tags' },
  {
    id: 'NotesStack',
    helpPageId: 'notes',
    entity: 'Note',
    list: ['Notes', 'list'],
    prefix: 'notes',
  },
  {
    id: 'GalleryStack',
    helpPageId: 'gallery',
    entity: 'Gallery',
    list: ['Gallery', 'list'],
    prefix: 'gallery',
    extra: {
      id: 'more',
      icons: ['brush-outline', 'musical-note-outline'],
      titleKey: 'tour_gallery_more_title',
      bodyKey: 'tour_gallery_more_body',
    },
  },
  { id: 'BoardsStack', helpPageId: 'boards', list: ['Boards', 'list'], prefix: 'boards' },
  { id: 'SketchStack', helpPageId: 'sketch', list: ['Sketches', 'list'], prefix: 'sketch' },
];

export const entityListGuides: Record<string, Guide> = Object.fromEntries(
  specs.map((spec) => [spec.id, entityListGuide(spec)]),
);
