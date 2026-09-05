import { OperationLogEntityType } from '@keres/shared';
import * as schema from '../../db/schema';

/**
 * PostgreSQL table adapter for the portable entity handlers. Entity semantics stay in
 * `@keres/shared`; this is only the API's physical storage mapping.
 */
export const API_ENTITY_TABLES: Partial<Record<OperationLogEntityType, any>> = {
  [OperationLogEntityType.AttributeValue]: schema.attributeValues,
  [OperationLogEntityType.Board]: schema.boards,
  [OperationLogEntityType.Chapter]: schema.chapters,
  [OperationLogEntityType.ChapterAnchor]: schema.chapterAnchors,
  [OperationLogEntityType.Character]: schema.characters,
  [OperationLogEntityType.CharacterRelation]: schema.characterRelations,
  [OperationLogEntityType.CharacterScene]: schema.characterScenes,
  [OperationLogEntityType.Choice]: schema.choices,
  [OperationLogEntityType.ChoiceCheck]: schema.choiceChecks,
  [OperationLogEntityType.ChoiceCheckGroup]: schema.choiceCheckGroups,
  [OperationLogEntityType.Comment]: schema.comments,
  [OperationLogEntityType.Effect]: schema.effects,
  [OperationLogEntityType.Favorite]: schema.favorites,
  [OperationLogEntityType.Gallery]: schema.galleries,
  [OperationLogEntityType.GalleryRelation]: schema.galleryRelations,
  [OperationLogEntityType.Item]: schema.items,
  [OperationLogEntityType.ItemJourney]: schema.itemJourneys,
  [OperationLogEntityType.Location]: schema.locations,
  [OperationLogEntityType.LocationMap]: schema.locationMaps,
  [OperationLogEntityType.LocationRelation]: schema.locationRelations,
  [OperationLogEntityType.Mode]: schema.modes,
  [OperationLogEntityType.Note]: schema.notes,
  [OperationLogEntityType.NoteRelation]: schema.noteRelations,
  [OperationLogEntityType.OperationLog]: schema.operationLog,
  [OperationLogEntityType.Plot]: schema.plots,
  [OperationLogEntityType.PlotScene]: schema.plotScenes,
  [OperationLogEntityType.Route]: schema.routes,
  [OperationLogEntityType.RouteStep]: schema.routeSteps,
  [OperationLogEntityType.Scene]: schema.scenes,
  [OperationLogEntityType.SeeAlsoRelation]: schema.seeAlsoRelations,
  [OperationLogEntityType.Stat]: schema.stats,
  [OperationLogEntityType.StatRelation]: schema.statRelations,
  [OperationLogEntityType.StatStrength]: schema.statStrengths,
  [OperationLogEntityType.Story]: schema.stories,
  [OperationLogEntityType.StoryArc]: schema.storyArcs,
  [OperationLogEntityType.StoryCalendar]: schema.storyCalendars,
  [OperationLogEntityType.StorySchemaField]: schema.storySchemaFields,
  [OperationLogEntityType.Suggestion]: schema.suggestions,
  [OperationLogEntityType.Tag]: schema.tags,
  [OperationLogEntityType.TagRelation]: schema.tagRelations,
  [OperationLogEntityType.User]: schema.users,
  [OperationLogEntityType.WorldRule]: schema.worldRules,
};

export function getApiEntityTable(entityType: string) {
  return API_ENTITY_TABLES[entityType as OperationLogEntityType];
}
