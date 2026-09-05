import { assertStorySyncHandlerCoverage } from '@keres/shared';
import { AttributeValueSyncHandler } from './AttributeValueSyncHandler';
import type { SyncEntityHandler } from './BaseSyncEntityHandler';
import { BoardSyncHandler } from './BoardSyncHandler';
import { ChapterAnchorSyncHandler } from './ChapterAnchorSyncHandler';
import { ChapterSyncHandler } from './ChapterSyncHandler';
import { CharacterRelationSyncHandler } from './CharacterRelationSyncHandler';
import { CharacterSceneSyncHandler } from './CharacterSceneSyncHandler';
import { CharacterSyncHandler } from './CharacterSyncHandler';
import { ChoiceCheckGroupSyncHandler } from './ChoiceCheckGroupSyncHandler';
import { ChoiceCheckSyncHandler } from './ChoiceCheckSyncHandler';
import { ChoiceSyncHandler } from './ChoiceSyncHandler';
import { CommentSyncHandler } from './CommentSyncHandler';
import { EffectSyncHandler } from './EffectSyncHandler';
import { FavoriteSyncHandler } from './FavoriteSyncHandler';
import { GalleryRelationSyncHandler } from './GalleryRelationSyncHandler';
import { GallerySyncHandler } from './GallerySyncHandler';
import { ItemJourneySyncHandler } from './ItemJourneySyncHandler';
import { ItemSyncHandler } from './ItemSyncHandler';
import { LocationMapSyncHandler } from './LocationMapSyncHandler';
import { LocationRelationSyncHandler } from './LocationRelationSyncHandler';
import { LocationSyncHandler } from './LocationSyncHandler';
import { ModeSyncHandler } from './ModeSyncHandler';
import { NoteRelationSyncHandler } from './NoteRelationSyncHandler';
import { NoteSyncHandler } from './NoteSyncHandler';
import { PlotSceneSyncHandler } from './PlotSceneSyncHandler';
import { PlotSyncHandler } from './PlotSyncHandler';
import { RouteStepSyncHandler } from './RouteStepSyncHandler';
import { RouteSyncHandler } from './RouteSyncHandler';
import { SceneSyncHandler } from './SceneSyncHandler';
import { SeeAlsoRelationSyncHandler } from './SeeAlsoRelationSyncHandler';
import { StatRelationSyncHandler } from './StatRelationSyncHandler';
import { StatStrengthSyncHandler } from './StatStrengthSyncHandler';
import { StatSyncHandler } from './StatSyncHandler';
import { StoryArcSyncHandler } from './StoryArcSyncHandler';
import { StoryCalendarSyncHandler } from './StoryCalendarSyncHandler';
import { StorySchemaFieldSyncHandler } from './StorySchemaFieldSyncHandler';
import { StorySyncHandler } from './StorySyncHandler';
import { SuggestionSyncHandler } from './SuggestionSyncHandler';
import { TagRelationSyncHandler } from './TagRelationSyncHandler';
import { TagSyncHandler } from './TagSyncHandler';
import { WorldRuleSyncHandler } from './WorldRuleSyncHandler';

/**
 * Builds the API's host-specific sync registry. Shared verifies its coverage, while individual
 * handlers retain their database validation and write rules.
 */
export function registerApiSyncHandlers(): Map<string, SyncEntityHandler> {
  const handlerFactories: readonly (() => SyncEntityHandler)[] = [
    () => new StorySyncHandler(),
    () => new CharacterSyncHandler(),
    () => new ChapterSyncHandler(),
    () => new LocationSyncHandler(),
    () => new SceneSyncHandler(),
    () => new GallerySyncHandler(),
    () => new GalleryRelationSyncHandler(),
    () => new NoteSyncHandler(),
    () => new WorldRuleSyncHandler(),
    () => new ChoiceSyncHandler(),
    () => new ChoiceCheckGroupSyncHandler(),
    () => new ChoiceCheckSyncHandler(),
    () => new EffectSyncHandler(),
    () => new CharacterSceneSyncHandler(),
    () => new ChapterAnchorSyncHandler(),
    () => new StoryCalendarSyncHandler(),
    () => new StoryArcSyncHandler(),
    () => new BoardSyncHandler(),
    () => new LocationMapSyncHandler(),
    () => new CharacterRelationSyncHandler(),
    () => new ItemSyncHandler(),
    () => new ItemJourneySyncHandler(),
    () => new PlotSyncHandler(),
    () => new PlotSceneSyncHandler(),
    () => new RouteSyncHandler(),
    () => new RouteStepSyncHandler(),
    () => new SuggestionSyncHandler(),
    () => new TagSyncHandler(),
    () => new TagRelationSyncHandler(),
    () => new NoteRelationSyncHandler(),
    () => new StorySchemaFieldSyncHandler(),
    () => new AttributeValueSyncHandler(),
    () => new LocationRelationSyncHandler(),
    () => new FavoriteSyncHandler(),
    () => new SeeAlsoRelationSyncHandler(),
    () => new CommentSyncHandler(),
    () => new ModeSyncHandler(),
    () => new StatSyncHandler(),
    () => new StatStrengthSyncHandler(),
    () => new StatRelationSyncHandler(),
  ];
  const handlers = handlerFactories.map((createHandler) => createHandler());
  const registry = new Map(handlers.map((handler) => [handler.entityName, handler]));
  if (registry.size !== handlers.length) {
    throw new Error('API sync handler registry contains duplicate entity types.');
  }
  assertStorySyncHandlerCoverage(registry.keys());
  return registry;
}
