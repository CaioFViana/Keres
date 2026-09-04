import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { chapterEntityHandler } from './ChapterEntityHandler';
import { choiceEntityHandler } from './ChoiceEntityHandler';
import type { EntityDomainHandler } from './contracts';
import { sceneEntityHandler } from './SceneEntityHandler';
import { routeEntityHandler } from './RouteEntityHandler';
import { routeStepEntityHandler } from './RouteStepEntityHandler';
import { plotEntityHandler } from './PlotEntityHandler';
import { plotSceneEntityHandler } from './PlotSceneEntityHandler';
import { itemEntityHandler } from './ItemEntityHandler';
import { itemJourneyEntityHandler } from './ItemJourneyEntityHandler';
import { characterEntityHandler } from './CharacterEntityHandler';
import { characterRelationEntityHandler } from './CharacterRelationEntityHandler';
import { locationEntityHandler } from './LocationEntityHandler';
import { noteEntityHandler } from './NoteEntityHandler';
import { tagEntityHandler } from './TagEntityHandler';
import { boardEntityHandler } from './BoardEntityHandler';
import { storyEntityHandler } from './StoryEntityHandler';
import { locationMapEntityHandler } from './LocationMapEntityHandler';
import { statEntityHandler } from './StatEntityHandler';
import { galleryEntityHandler } from './GalleryEntityHandler';
import { worldRuleEntityHandler } from './WorldRuleEntityHandler';
import { modeEntityHandler } from './ModeEntityHandler';
import { characterSceneEntityHandler } from './CharacterSceneEntityHandler';
import { locationRelationEntityHandler } from './LocationRelationEntityHandler';
import { noteRelationEntityHandler } from './NoteRelationEntityHandler';
import { tagRelationEntityHandler } from './TagRelationEntityHandler';
import { galleryRelationEntityHandler } from './GalleryRelationEntityHandler';
import { seeAlsoRelationEntityHandler } from './SeeAlsoRelationEntityHandler';
import { userEntityHandler } from './UserEntityHandler';
import { suggestionEntityHandler } from './SuggestionEntityHandler';
import { favoriteEntityHandler } from './FavoriteEntityHandler';
import { operationLogEntityHandler } from './OperationLogEntityHandler';
import { storySchemaFieldEntityHandler } from './StorySchemaFieldEntityHandler';
import { attributeValueEntityHandler } from './AttributeValueEntityHandler';
import { commentEntityHandler } from './CommentEntityHandler';
import { choiceCheckGroupEntityHandler } from './ChoiceCheckGroupEntityHandler';
import { choiceCheckEntityHandler } from './ChoiceCheckEntityHandler';
import { effectEntityHandler } from './EffectEntityHandler';
import { statStrengthEntityHandler } from './StatStrengthEntityHandler';
import { statRelationEntityHandler } from './StatRelationEntityHandler';
import { chapterAnchorEntityHandler } from './ChapterAnchorEntityHandler';
import { storyCalendarEntityHandler } from './StoryCalendarEntityHandler';
import { storyArcEntityHandler } from './StoryArcEntityHandler';

const ENTITY_HANDLERS: ReadonlyMap<OperationLogEntityType, EntityDomainHandler> = new Map([
  [chapterEntityHandler.entityType, chapterEntityHandler],
  [choiceEntityHandler.entityType, choiceEntityHandler],
  [storyArcEntityHandler.entityType, storyArcEntityHandler],
  [sceneEntityHandler.entityType, sceneEntityHandler],
  [routeEntityHandler.entityType, routeEntityHandler],
  [routeStepEntityHandler.entityType, routeStepEntityHandler],
  [plotEntityHandler.entityType, plotEntityHandler],
  [plotSceneEntityHandler.entityType, plotSceneEntityHandler],
  [itemEntityHandler.entityType, itemEntityHandler],
  [itemJourneyEntityHandler.entityType, itemJourneyEntityHandler],
  [characterEntityHandler.entityType, characterEntityHandler],
  [characterRelationEntityHandler.entityType, characterRelationEntityHandler],
  [locationEntityHandler.entityType, locationEntityHandler],
  [noteEntityHandler.entityType, noteEntityHandler],
  [tagEntityHandler.entityType, tagEntityHandler],
  [boardEntityHandler.entityType, boardEntityHandler],
  [storyEntityHandler.entityType, storyEntityHandler],
  [locationMapEntityHandler.entityType, locationMapEntityHandler],
  [statEntityHandler.entityType, statEntityHandler],
  [galleryEntityHandler.entityType, galleryEntityHandler],
  [worldRuleEntityHandler.entityType, worldRuleEntityHandler],
  [modeEntityHandler.entityType, modeEntityHandler],
  [characterSceneEntityHandler.entityType, characterSceneEntityHandler],
  [locationRelationEntityHandler.entityType, locationRelationEntityHandler],
  [noteRelationEntityHandler.entityType, noteRelationEntityHandler],
  [tagRelationEntityHandler.entityType, tagRelationEntityHandler],
  [galleryRelationEntityHandler.entityType, galleryRelationEntityHandler],
  [seeAlsoRelationEntityHandler.entityType, seeAlsoRelationEntityHandler],
  [userEntityHandler.entityType, userEntityHandler],
  [suggestionEntityHandler.entityType, suggestionEntityHandler],
  [favoriteEntityHandler.entityType, favoriteEntityHandler],
  [operationLogEntityHandler.entityType, operationLogEntityHandler],
  [storySchemaFieldEntityHandler.entityType, storySchemaFieldEntityHandler],
  [attributeValueEntityHandler.entityType, attributeValueEntityHandler],
  [commentEntityHandler.entityType, commentEntityHandler],
  [choiceCheckGroupEntityHandler.entityType, choiceCheckGroupEntityHandler],
  [choiceCheckEntityHandler.entityType, choiceCheckEntityHandler],
  [effectEntityHandler.entityType, effectEntityHandler],
  [statStrengthEntityHandler.entityType, statStrengthEntityHandler],
  [statRelationEntityHandler.entityType, statRelationEntityHandler],
  [chapterAnchorEntityHandler.entityType, chapterAnchorEntityHandler],
  [storyCalendarEntityHandler.entityType, storyCalendarEntityHandler],
]);

/** Factory for entity-owned domain presentation. An unknown external type has no handler. */
export function getEntityDomainHandler(
  entityType: OperationLogEntityType,
): EntityDomainHandler | undefined {
  return ENTITY_HANDLERS.get(entityType);
}

export function getEntityReferenceFieldType(field: string): OperationLogEntityType | undefined {
  for (const handler of ENTITY_HANDLERS.values()) {
    const entityType = handler.referenceFields?.[field];
    if (entityType) return entityType;
  }
  return undefined;
}
