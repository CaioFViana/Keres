import { AttributeValueClientSyncHandler } from '@/src/services/entity-sync-handlers/AttributeValueClientSyncHandler';
import { assertStorySyncHandlerCoverage } from '@keres/shared';
import { ChapterClientSyncHandler } from '@/src/services/entity-sync-handlers/ChapterClientSyncHandler';
import { CharacterClientSyncHandler } from '@/src/services/entity-sync-handlers/CharacterClientSyncHandler';
import { ChapterAnchorClientSyncHandler } from '@/src/services/entity-sync-handlers/ChapterAnchorClientSyncHandler';
import { BoardClientSyncHandler } from '@/src/services/entity-sync-handlers/BoardClientSyncHandler';
import { SketchClientSyncHandler } from '@/src/services/entity-sync-handlers/SketchClientSyncHandler';
import { ScenePageClientSyncHandler } from '@/src/services/entity-sync-handlers/ScenePageClientSyncHandler';
import { SceneMusicClientSyncHandler } from '@/src/services/entity-sync-handlers/SceneMusicClientSyncHandler';
import { SongClientSyncHandler } from '@/src/services/entity-sync-handlers/SongClientSyncHandler';
import { StoryCalendarClientSyncHandler } from '@/src/services/entity-sync-handlers/StoryCalendarClientSyncHandler';
import { StoryArcClientSyncHandler } from '@/src/services/entity-sync-handlers/StoryArcClientSyncHandler';
import { CharacterRelationClientSyncHandler } from '@/src/services/entity-sync-handlers/CharacterRelationClientSyncHandler';
import { CharacterSceneClientSyncHandler } from '@/src/services/entity-sync-handlers/CharacterSceneClientSyncHandler';
import { ChoiceCheckClientSyncHandler } from '@/src/services/entity-sync-handlers/ChoiceCheckClientSyncHandler';
import { ChoiceCheckGroupClientSyncHandler } from '@/src/services/entity-sync-handlers/ChoiceCheckGroupClientSyncHandler';
import { ChoiceClientSyncHandler } from '@/src/services/entity-sync-handlers/ChoiceClientSyncHandler';
import type { ClientSyncEntityHandler } from '@/src/services/entity-sync-handlers/ClientSyncEntityHandler';
import { CommentClientSyncHandler } from '@/src/services/entity-sync-handlers/CommentClientSyncHandler';
import { EffectClientSyncHandler } from '@/src/services/entity-sync-handlers/EffectClientSyncHandler';
import { FavoriteClientSyncHandler } from '@/src/services/entity-sync-handlers/FavoriteClientSyncHandler';
import { GalleryClientSyncHandler } from '@/src/services/entity-sync-handlers/GalleryClientSyncHandler';
import { GalleryRelationClientSyncHandler } from '@/src/services/entity-sync-handlers/GalleryRelationClientSyncHandler';
import { ItemClientSyncHandler } from '@/src/services/entity-sync-handlers/ItemClientSyncHandler';
import { ItemJourneyClientSyncHandler } from '@/src/services/entity-sync-handlers/ItemJourneyClientSyncHandler';
import { LocationClientSyncHandler } from '@/src/services/entity-sync-handlers/LocationClientSyncHandler';
import { LocationMapClientSyncHandler } from '@/src/services/entity-sync-handlers/LocationMapClientSyncHandler';
import { LocationRelationClientSyncHandler } from '@/src/services/entity-sync-handlers/LocationRelationClientSyncHandler';
import { NoteClientSyncHandler } from '@/src/services/entity-sync-handlers/NoteClientSyncHandler';
import { NoteRelationClientSyncHandler } from '@/src/services/entity-sync-handlers/NoteRelationClientSyncHandler';
import { PlotClientSyncHandler } from '@/src/services/entity-sync-handlers/PlotClientSyncHandler';
import { PlotSceneClientSyncHandler } from '@/src/services/entity-sync-handlers/PlotSceneClientSyncHandler';
import { RouteClientSyncHandler } from '@/src/services/entity-sync-handlers/RouteClientSyncHandler';
import { RouteStepClientSyncHandler } from '@/src/services/entity-sync-handlers/RouteStepClientSyncHandler';
import { SceneClientSyncHandler } from '@/src/services/entity-sync-handlers/SceneClientSyncHandler';
import { SeeAlsoRelationClientSyncHandler } from '@/src/services/entity-sync-handlers/SeeAlsoRelationClientSyncHandler';
import {
  ModeClientSyncHandler,
  StatClientSyncHandler,
  StatRelationClientSyncHandler,
  StatStrengthClientSyncHandler,
} from '@/src/services/entity-sync-handlers/StatClientSyncHandler';
import { StoryClientSyncHandler } from '@/src/services/entity-sync-handlers/StoryClientSyncHandler';
import { StorySchemaFieldClientSyncHandler } from '@/src/services/entity-sync-handlers/StorySchemaFieldClientSyncHandler';
import { SuggestionClientSyncHandler } from '@/src/services/entity-sync-handlers/SuggestionClientSyncHandler';
import { TagClientSyncHandler } from '@/src/services/entity-sync-handlers/TagClientSyncHandler';
import { TagRelationClientSyncHandler } from '@/src/services/entity-sync-handlers/TagRelationClientSyncHandler';
import { WorldRuleClientSyncHandler } from '@/src/services/entity-sync-handlers/WorldRuleClientSyncHandler';

/** Builds the complete entity-handler registry used by each sync-engine instance. */
export function registerClientSyncHandlers(): Map<string, ClientSyncEntityHandler> {
  const handlers: ClientSyncEntityHandler[] = [
    new StoryClientSyncHandler(),
    new CharacterClientSyncHandler(),
    new TagClientSyncHandler(),
    new TagRelationClientSyncHandler(),
    new NoteClientSyncHandler(),
    new NoteRelationClientSyncHandler(),
    new WorldRuleClientSyncHandler(),
    new ChapterAnchorClientSyncHandler(),
    new StoryCalendarClientSyncHandler(),
    new StoryArcClientSyncHandler(),
    new BoardClientSyncHandler(),
    new SketchClientSyncHandler(),
    new ScenePageClientSyncHandler(),
    new SceneMusicClientSyncHandler(),
    new SongClientSyncHandler(),
    new CharacterRelationClientSyncHandler(),
    new LocationClientSyncHandler(),
    new LocationMapClientSyncHandler(),
    new LocationRelationClientSyncHandler(),
    new ChapterClientSyncHandler(),
    new CharacterSceneClientSyncHandler(),
    new ChoiceClientSyncHandler(),
    new ChoiceCheckGroupClientSyncHandler(),
    new ChoiceCheckClientSyncHandler(),
    new EffectClientSyncHandler(),
    new ItemClientSyncHandler(),
    new ItemJourneyClientSyncHandler(),
    new PlotClientSyncHandler(),
    new PlotSceneClientSyncHandler(),
    new RouteClientSyncHandler(),
    new RouteStepClientSyncHandler(),
    new SceneClientSyncHandler(),
    new GalleryClientSyncHandler(),
    new GalleryRelationClientSyncHandler(),
    new StorySchemaFieldClientSyncHandler(),
    new AttributeValueClientSyncHandler(),
    new FavoriteClientSyncHandler(),
    new SeeAlsoRelationClientSyncHandler(),
    new CommentClientSyncHandler(),
    new SuggestionClientSyncHandler(),
    new StatClientSyncHandler(),
    new StatStrengthClientSyncHandler(),
    new StatRelationClientSyncHandler(),
    new ModeClientSyncHandler(),
  ];

  const registry = new Map(handlers.map((handler) => [handler.entityName, handler]));
  assertStorySyncHandlerCoverage(registry.keys());
  return registry;
}
