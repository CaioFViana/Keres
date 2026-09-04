import {
  chapterEntityHandler,
  choiceEntityHandler,
  plotEntityHandler,
  plotSceneEntityHandler,
  itemEntityHandler,
  itemJourneyEntityHandler,
  characterEntityHandler,
  characterRelationEntityHandler,
  galleryEntityHandler,
  locationEntityHandler,
  modeEntityHandler,
  noteEntityHandler,
  routeEntityHandler,
  routeStepEntityHandler,
  sceneEntityHandler,
  statEntityHandler,
  statRelationEntityHandler,
  statStrengthEntityHandler,
  storyEntityHandler,
  storyArcEntityHandler,
  storySchemaFieldEntityHandler,
  tagEntityHandler,
  boardEntityHandler,
  worldRuleEntityHandler,
} from '@keres/shared';

const chapterHelp = chapterEntityHandler.help!;
const arcHelp = storyArcEntityHandler.help!;
const sceneHelp = sceneEntityHandler.help!;
const choiceHelp = choiceEntityHandler.help!;
const routeHelp = routeEntityHandler.help!;
const routeStepHelp = routeStepEntityHandler.help!;
const plotHelp = plotEntityHandler.help!;
const plotSceneHelp = plotSceneEntityHandler.help!;
const itemHelp = itemEntityHandler.help!;
const itemJourneyHelp = itemJourneyEntityHandler.help!;
const characterHelp = characterEntityHandler.help!;
const characterRelationHelp = characterRelationEntityHandler.help!;
const storyHelp = storyEntityHandler.help!;
const modeHelp = modeEntityHandler.help!;
const statHelp = statEntityHandler.help!;
const statStrengthHelp = statStrengthEntityHandler.help!;
const statRelationHelp = statRelationEntityHandler.help!;
const locationHelp = locationEntityHandler.help!;
const noteHelp = noteEntityHandler.help!;
const tagHelp = tagEntityHandler.help!;
const galleryHelp = galleryEntityHandler.help!;
const boardHelp = boardEntityHandler.help!;
const worldRuleHelp = worldRuleEntityHandler.help!;
const customAttributeHelp = storySchemaFieldEntityHandler.help!;

/** Visible fields the help has to explain. Kept apart from the model to avoid exposing internal data. */
export const fieldSources: Record<string, string[]> = {
  'create-story': [...storyHelp.fields],
  'character-modes': [...modeHelp.fields],
  stats: [...statHelp.fields, ...statStrengthHelp.fields, ...statRelationHelp.fields],
  characters: [...characterHelp.fields],
  chapters: [...chapterHelp.fields],
  scenes: [...sceneHelp.fields],
  locations: [...locationHelp.fields],
  items: [...itemHelp.fields],
  'item-journeys': [...itemJourneyHelp.fields],
  'character-relationships': [...characterRelationHelp.fields],
  'world-rules': [...worldRuleHelp.fields],
  notes: [...noteHelp.fields],
  tags: [...tagHelp.fields],
  gallery: [...galleryHelp.fields],
  boards: [...boardHelp.fields],
  arcs: [...arcHelp.fields],
  choices: [...choiceHelp.fields],
  plots: [...plotHelp.fields, ...plotSceneHelp.fields],
  routes: [...routeHelp.fields, ...routeStepHelp.fields],
  'custom-attributes': [...customAttributeHelp.fields],
};

/** The help page that explains fields exposed by the advanced-search metadata. */
export const entityMetadataHelpPages = {
  Character: 'characters',
  Tag: 'tags',
  Note: 'notes',
  WorldRule: 'world-rules',
  CharacterRelation: 'character-relationships',
  Location: 'locations',
  Item: 'items',
  ItemJourney: 'item-journeys',
  Chapter: chapterHelp.source,
  Scene: 'scenes',
  Board: 'boards',
  Choice: 'choices',
  Mode: 'character-modes',
  Plot: 'plots',
  Route: 'routes',
} as const;
