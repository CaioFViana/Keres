import { AttributeValueClientSyncHandler } from '../entity-sync-handlers/AttributeValueClientSyncHandler';
import { ChapterClientSyncHandler } from '../entity-sync-handlers/ChapterClientSyncHandler';
import { CharacterClientSyncHandler } from '../entity-sync-handlers/CharacterClientSyncHandler';
import { ChapterAnchorClientSyncHandler } from '../entity-sync-handlers/ChapterAnchorClientSyncHandler';
import { CharacterRelationClientSyncHandler } from '../entity-sync-handlers/CharacterRelationClientSyncHandler';
import { CharacterSceneClientSyncHandler } from '../entity-sync-handlers/CharacterSceneClientSyncHandler';
import { ChoiceCheckClientSyncHandler } from '../entity-sync-handlers/ChoiceCheckClientSyncHandler';
import { ChoiceCheckGroupClientSyncHandler } from '../entity-sync-handlers/ChoiceCheckGroupClientSyncHandler';
import { ChoiceClientSyncHandler } from '../entity-sync-handlers/ChoiceClientSyncHandler';
import type { ClientSyncEntityHandler } from '../entity-sync-handlers/ClientSyncEntityHandler';
import { CommentClientSyncHandler } from '../entity-sync-handlers/CommentClientSyncHandler';
import { EffectClientSyncHandler } from '../entity-sync-handlers/EffectClientSyncHandler';
import { FavoriteClientSyncHandler } from '../entity-sync-handlers/FavoriteClientSyncHandler';
import { GalleryClientSyncHandler } from '../entity-sync-handlers/GalleryClientSyncHandler';
import { GalleryRelationClientSyncHandler } from '../entity-sync-handlers/GalleryRelationClientSyncHandler';
import { ItemClientSyncHandler } from '../entity-sync-handlers/ItemClientSyncHandler';
import { ItemJourneyClientSyncHandler } from '../entity-sync-handlers/ItemJourneyClientSyncHandler';
import { LocationClientSyncHandler } from '../entity-sync-handlers/LocationClientSyncHandler';
import { LocationRelationClientSyncHandler } from '../entity-sync-handlers/LocationRelationClientSyncHandler';
import { NoteClientSyncHandler } from '../entity-sync-handlers/NoteClientSyncHandler';
import { NoteRelationClientSyncHandler } from '../entity-sync-handlers/NoteRelationClientSyncHandler';
import { PlotClientSyncHandler } from '../entity-sync-handlers/PlotClientSyncHandler';
import { PlotSceneClientSyncHandler } from '../entity-sync-handlers/PlotSceneClientSyncHandler';
import { SceneClientSyncHandler } from '../entity-sync-handlers/SceneClientSyncHandler';
import { SeeAlsoRelationClientSyncHandler } from '../entity-sync-handlers/SeeAlsoRelationClientSyncHandler';
import {
  ModeClientSyncHandler,
  StatClientSyncHandler,
  StatRelationClientSyncHandler,
  StatStrengthClientSyncHandler,
} from '../entity-sync-handlers/StatClientSyncHandler';
import { StoryClientSyncHandler } from '../entity-sync-handlers/StoryClientSyncHandler';
import { StorySchemaFieldClientSyncHandler } from '../entity-sync-handlers/StorySchemaFieldClientSyncHandler';
import { SuggestionClientSyncHandler } from '../entity-sync-handlers/SuggestionClientSyncHandler';
import { TagClientSyncHandler } from '../entity-sync-handlers/TagClientSyncHandler';
import { WorldRuleClientSyncHandler } from '../entity-sync-handlers/WorldRuleClientSyncHandler';

/** Builds the complete entity-handler registry used by each sync-engine instance. */
export function registerClientSyncHandlers(): Map<string, ClientSyncEntityHandler> {
  const handlers: ClientSyncEntityHandler[] = [
    new StoryClientSyncHandler(),
    new CharacterClientSyncHandler(),
    new TagClientSyncHandler(),
    new NoteClientSyncHandler(),
    new NoteRelationClientSyncHandler(),
    new WorldRuleClientSyncHandler(),
    new ChapterAnchorClientSyncHandler(),
    new CharacterRelationClientSyncHandler(),
    new LocationClientSyncHandler(),
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

  return new Map(handlers.map((handler) => [handler.entityName, handler]));
}
