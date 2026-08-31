import { OperationLogEntityType } from '@keres/shared';
import type { StoryVocabulary } from '@keres/shared/entities/Story';
import { and, eq } from 'drizzle-orm';
import type { TFunction } from 'i18next';
import type { AppDrizzleClient } from '../db';
import {
  boards,
  chapters,
  characterRelations,
  characters,
  characterScenes,
  choices,
  galleries,
  galleryRelations,
  itemJourneys,
  items,
  locations,
  locationMaps,
  locationRelations,
  modes,
  noteRelations,
  notes,
  plots,
  plotScenes,
  routes,
  routeSteps,
  scenes,
  seeAlsoRelations,
  stats,
  stories,
  tagRelations,
  tags,
  worldRules,
} from '../db/schemas';
import {
  loadStoryVocabulary,
  translateStoryNoun,
  unknownStoryNoun,
} from '../vocabulary/storyVocabularyLookup';
const ENTITY_LOOKUP_MAP: Record<string, OperationLogEntityType> = {
  board: OperationLogEntityType.Board,
  locationmap: OperationLogEntityType.LocationMap,
  chapter: OperationLogEntityType.Chapter,
  character: OperationLogEntityType.Character,
  choice: OperationLogEntityType.Choice,
  item: OperationLogEntityType.Item,
  itemjourney: OperationLogEntityType.ItemJourney,
  location: OperationLogEntityType.Location,
  note: OperationLogEntityType.Note,
  operationlog: OperationLogEntityType.OperationLog,
  scene: OperationLogEntityType.Scene,
  story: OperationLogEntityType.Story,
  tag: OperationLogEntityType.Tag,
  user: OperationLogEntityType.User,
  worldrule: OperationLogEntityType.WorldRule,
  characterrelation: OperationLogEntityType.CharacterRelation,
  locationrelation: OperationLogEntityType.LocationRelation,
  noterelation: OperationLogEntityType.NoteRelation,
  tagrelation: OperationLogEntityType.TagRelation,
  characterscene: OperationLogEntityType.CharacterScene,
  plot: OperationLogEntityType.Plot,
  plotscene: OperationLogEntityType.PlotScene,
  route: OperationLogEntityType.Route,
  routestep: OperationLogEntityType.RouteStep,
  gallery: OperationLogEntityType.Gallery,
  galleryrelation: OperationLogEntityType.GalleryRelation,
  favorite: OperationLogEntityType.Favorite,
  seealsorelation: OperationLogEntityType.SeeAlsoRelation,
  comment: OperationLogEntityType.Comment,
  choicecheckgroup: OperationLogEntityType.ChoiceCheckGroup,
  choicecheck: OperationLogEntityType.ChoiceCheck,
  effect: OperationLogEntityType.Effect,
  stat: OperationLogEntityType.Stat,
  statstrength: OperationLogEntityType.StatStrength,
  statrelation: OperationLogEntityType.StatRelation,
  mode: OperationLogEntityType.Mode,
};
export async function resolveRelationEntityName(
  db: AppDrizzleClient,
  relationType: OperationLogEntityType,
  relationId: string,
  storyId: string,
  t: TFunction,
): Promise<{ name: string | undefined; type: string | undefined }> {
  let name: string | undefined;
  let type: string | undefined;
  // Relation labels are often resolved in batches. Only a handful of relations use a
  // terminology-aware noun, so avoid reading the story unless one is actually encountered.
  let vocabularyPromise: Promise<StoryVocabulary | null> | undefined;
  const vocabulary = () => (vocabularyPromise ??= loadStoryVocabulary(db, storyId));
  switch (relationType) {
    case OperationLogEntityType.Board:
      const board = await db.query.boards.findFirst({
        where: and(
          eq(boards.id, relationId),
          eq(boards.storyId, storyId),
          eq(boards.isDeleted, false),
        ),
        columns: { name: true },
      });
      name = board?.name;
      type = t('board');
      break;
    case OperationLogEntityType.Story:
      const story = await db.query.stories.findFirst({
        where: and(
          eq(stories.id, relationId),
          eq(stories.id, storyId),
          eq(stories.isDeleted, false),
        ),
        columns: { title: true },
      });
      name = story?.title;
      type = t('story');
      break;
    case OperationLogEntityType.Route:
      const route = await db.query.routes.findFirst({
        where: and(
          eq(routes.id, relationId),
          eq(routes.storyId, storyId),
          eq(routes.isDeleted, false),
        ),
        columns: { name: true },
      });
      name = route?.name;
      type = t('route');
      break;
    case OperationLogEntityType.RouteStep:
      const routeStep = await db.query.routeSteps.findFirst({
        where: and(
          eq(routeSteps.id, relationId),
          eq(routeSteps.storyId, storyId),
          eq(routeSteps.isDeleted, false),
        ),
        columns: { routeId: true, position: true, sceneId: true },
      });
      if (routeStep) {
        const routeForStep = await db.query.routes.findFirst({
          where: and(eq(routes.id, routeStep.routeId), eq(routes.isDeleted, false)),
          columns: { name: true },
        });
        const sceneForStep = await db.query.scenes.findFirst({
          where: and(eq(scenes.id, routeStep.sceneId), eq(scenes.isDeleted, false)),
          columns: { name: true },
        });
        name = `${routeForStep?.name || t('unknown_entity')} · ${routeStep.position}: ${sceneForStep?.name || unknownStoryNoun(t, await vocabulary(), 'Scene')}`;
      }
      type = t('route_step');
      break;
    case OperationLogEntityType.Character:
      const character = await db.query.characters.findFirst({
        where: and(
          eq(characters.id, relationId),
          eq(characters.storyId, storyId),
          eq(characters.isDeleted, false),
        ),
        columns: { name: true },
      });
      name = character?.name;
      type = translateStoryNoun(t, await vocabulary(), 'Character');
      break;
    case OperationLogEntityType.Note:
      const note = await db.query.notes.findFirst({
        where: and(
          eq(notes.id, relationId),
          eq(notes.storyId, storyId),
          eq(notes.isDeleted, false),
        ),
        columns: { title: true },
      });
      name = note?.title;
      type = t('note');
      break;
    case OperationLogEntityType.Location:
      const location = await db.query.locations.findFirst({
        where: and(
          eq(locations.id, relationId),
          eq(locations.storyId, storyId),
          eq(locations.isDeleted, false),
        ),
        columns: { name: true },
      });
      name = location?.name;
      type = translateStoryNoun(t, await vocabulary(), 'Location');
      break;
    case OperationLogEntityType.WorldRule:
      const worldRule = await db.query.worldRules.findFirst({
        where: and(
          eq(worldRules.id, relationId),
          eq(worldRules.storyId, storyId),
          eq(worldRules.isDeleted, false),
        ),
        columns: { title: true },
      });
      name = worldRule?.title;
      type = translateStoryNoun(t, await vocabulary(), 'WorldRule');
      break;
    case OperationLogEntityType.LocationMap:
      const locationMap = await db.query.locationMaps.findFirst({
        where: and(
          eq(locationMaps.id, relationId),
          eq(locationMaps.storyId, storyId),
          eq(locationMaps.isDeleted, false),
        ),
        columns: { name: true },
      });
      name = locationMap?.name;
      type = t('location_map');
      break;
    case OperationLogEntityType.Chapter:
      const chapter = await db.query.chapters.findFirst({
        where: and(
          eq(chapters.id, relationId),
          eq(chapters.storyId, storyId),
          eq(chapters.isDeleted, false),
        ),
        columns: { name: true, type: true },
      });
      name = chapter?.name;
      type = translateStoryNoun(
        t,
        await vocabulary(),
        chapter?.type === 'event' ? 'Event' : 'Chapter',
      );
      break;
    case OperationLogEntityType.Scene:
      const scene = await db.query.scenes.findFirst({
        where: and(
          eq(scenes.id, relationId),
          eq(scenes.storyId, storyId),
          eq(scenes.isDeleted, false),
        ),
        columns: { name: true },
      });
      name = scene?.name;
      type = translateStoryNoun(t, await vocabulary(), 'Scene');
      break;
    case OperationLogEntityType.Item:
      const item = await db.query.items.findFirst({
        where: and(
          eq(items.id, relationId),
          eq(items.storyId, storyId),
          eq(items.isDeleted, false),
        ),
        columns: { name: true },
      });
      name = item?.name;
      type = translateStoryNoun(t, await vocabulary(), 'Item');
      break;
    case OperationLogEntityType.Choice:
      const relatedChoice = await db.query.choices.findFirst({
        where: and(
          eq(choices.id, relationId),
          eq(choices.storyId, storyId),
          eq(choices.isDeleted, false),
        ),
        columns: { text: true },
      });
      name = relatedChoice?.text;
      type = translateStoryNoun(t, await vocabulary(), 'Choice');
      break;
    case OperationLogEntityType.Tag:
      const relatedTag = await db.query.tags.findFirst({
        where: and(eq(tags.id, relationId), eq(tags.storyId, storyId), eq(tags.isDeleted, false)),
        columns: { name: true },
      });
      name = relatedTag?.name;
      type = t('tag');
      break;
    case OperationLogEntityType.Gallery:
      const gallery = await db.query.galleries.findFirst({
        where: and(
          eq(galleries.id, relationId),
          eq(galleries.storyId, storyId),
          eq(galleries.isDeleted, false),
        ),
        columns: { title: true, fileName: true },
      });
      name = gallery?.title || gallery?.fileName;
      type = t('gallery');
      break;
    case OperationLogEntityType.ItemJourney:
      const itemJourney = await db.query.itemJourneys.findFirst({
        where: and(
          eq(itemJourneys.id, relationId),
          eq(itemJourneys.storyId, storyId),
          eq(itemJourneys.isDeleted, false),
        ),
        columns: { itemId: true, sceneId: true },
      });
      if (itemJourney) {
        const relatedItem = await db.query.items.findFirst({
          where: and(eq(items.id, itemJourney.itemId), eq(items.isDeleted, false)),
          columns: { name: true },
        });
        const targetScene = await db.query.scenes.findFirst({
          where: and(eq(scenes.id, itemJourney.sceneId), eq(scenes.isDeleted, false)),
          columns: { name: true },
        });
        name = `${relatedItem?.name || unknownStoryNoun(t, await vocabulary(), 'Item')} ${t('showed_in_scene')} ${targetScene?.name || unknownStoryNoun(t, await vocabulary(), 'Scene')}`;
      }
      type = t('item_journey');
      break;
    case OperationLogEntityType.NoteRelation:
      const noteRelation = await db.query.noteRelations.findFirst({
        where: and(
          eq(noteRelations.id, relationId),
          eq(noteRelations.storyId, storyId),
          eq(noteRelations.isDeleted, false),
        ),
        columns: { noteId: true, relationId: true, relationType: true },
      });
      if (noteRelation) {
        const note = await db.query.notes.findFirst({
          where: and(
            eq(notes.id, noteRelation.noteId),
            eq(notes.storyId, storyId),
            eq(notes.isDeleted, false),
          ),
          columns: { title: true },
        });
        const relatedEntity = await resolveRelationEntityName(
          db,
          noteRelation.relationType as OperationLogEntityType,
          noteRelation.relationId,
          storyId,
          t,
        );
        name = t('note_attributed_to_entity_short', {
          notename: note?.title || t('unknown_note'),
          entityname: relatedEntity.name || t('unknown_entity'),
          entitytype: relatedEntity.type || t('unknown_entity_type'),
        });
        type = t('note_relation');
      }
      break;
    case OperationLogEntityType.CharacterRelation:
      const characterRelation = await db.query.characterRelations.findFirst({
        where: and(eq(characterRelations.id, relationId), eq(characterRelations.isDeleted, false)),
        columns: { character1Id: true, character2Id: true },
      });
      if (characterRelation) {
        const char1 = await db.query.characters.findFirst({
          where: and(
            eq(characters.id, characterRelation.character1Id),
            eq(characters.isDeleted, false),
          ),
          columns: { name: true },
        });
        const char2 = await db.query.characters.findFirst({
          where: and(
            eq(characters.id, characterRelation.character2Id),
            eq(characters.isDeleted, false),
          ),
          columns: { name: true },
        });
        name = `${char1?.name || t('unknown_character')} - ${char2?.name || t('unknown_character')} ${t('relation')}`;
      }
      type = t('character_relation');
      break;
    case OperationLogEntityType.LocationRelation:
      const locationRelation = await db.query.locationRelations.findFirst({
        where: and(
          eq(locationRelations.id, relationId),
          eq(locationRelations.storyId, storyId),
          eq(locationRelations.isDeleted, false),
        ),
        columns: { locationAId: true, locationBId: true, relationType: true },
      });
      if (locationRelation) {
        const locationA = await db.query.locations.findFirst({
          where: and(
            eq(locations.id, locationRelation.locationAId),
            eq(locations.isDeleted, false),
          ),
          columns: { name: true },
        });
        const locationB = await db.query.locations.findFirst({
          where: and(
            eq(locations.id, locationRelation.locationBId),
            eq(locations.isDeleted, false),
          ),
          columns: { name: true },
        });
        const nameA = locationA?.name || t('unknown_location');
        const nameB = locationB?.name || t('unknown_location');
        name =
          locationRelation.relationType === 'contains'
            ? t('location_contains_location', { parentName: nameA, childName: nameB })
            : t('location_connected_to_location', { locationAName: nameA, locationBName: nameB });
      }
      type = t('location_relation');
      break;
    case OperationLogEntityType.TagRelation:
      const tagRelationForIdentifier = await db.query.tagRelations.findFirst({
        where: and(
          eq(tagRelations.id, relationId),
          eq(tagRelations.storyId, storyId),
          eq(tagRelations.isDeleted, false),
        ),
        columns: { tagId: true, relationId: true, relationType: true },
      });
      if (tagRelationForIdentifier) {
        const relatedTagForIdentifier = await db.query.tags.findFirst({
          where: and(
            eq(tags.id, tagRelationForIdentifier.tagId),
            eq(tags.storyId, storyId),
            eq(tags.isDeleted, false),
          ),
          columns: { name: true },
        });
        const relatedForTag = await resolveRelationEntityName(
          db,
          tagRelationForIdentifier.relationType as OperationLogEntityType,
          tagRelationForIdentifier.relationId,
          storyId,
          t,
        );
        name = t('tag_attributed_to_entity', {
          tagname: relatedTagForIdentifier?.name || t('unknown_tag'),
          entityname: relatedForTag.name || t('unknown_entity'),
          entitytype: relatedForTag.type || t('unknown_entity_type'),
        });
      }
      type = t('tag_relation');
      break;
    case OperationLogEntityType.CharacterScene:
      const characterScene = await db.query.characterScenes.findFirst({
        where: and(eq(characterScenes.id, relationId), eq(characterScenes.isDeleted, false)),
        columns: { characterId: true, sceneId: true },
      });
      if (characterScene) {
        const relatedCharacter = await db.query.characters.findFirst({
          where: and(
            eq(characters.id, characterScene.characterId),
            eq(characters.isDeleted, false),
          ),
          columns: { name: true },
        });
        const relatedScene = await db.query.scenes.findFirst({
          where: and(eq(scenes.id, characterScene.sceneId), eq(scenes.isDeleted, false)),
          columns: { name: true },
        });
        name = t('character_attributed_to_scene', {
          characterName: relatedCharacter?.name || t('unknown_character'),
          sceneName: relatedScene?.name || unknownStoryNoun(t, await vocabulary(), 'Scene'),
        });
      }
      type = t('character_scene_relation');
      break;
    case OperationLogEntityType.Plot:
      const plotForIdentifier = await db.query.plots.findFirst({
        where: and(eq(plots.id, relationId), eq(plots.isDeleted, false)),
        columns: { name: true },
      });
      name = plotForIdentifier?.name || relationId;
      type = t('plots_title');
      break;
    case OperationLogEntityType.PlotScene:
      const plotSceneForIdentifier = await db.query.plotScenes.findFirst({
        where: and(eq(plotScenes.id, relationId), eq(plotScenes.isDeleted, false)),
        columns: { plotId: true, sceneId: true },
      });
      if (plotSceneForIdentifier) {
        const [plotForRelation, sceneForRelation] = await Promise.all([
          db.query.plots.findFirst({
            where: eq(plots.id, plotSceneForIdentifier.plotId),
            columns: { name: true },
          }),
          db.query.scenes.findFirst({
            where: eq(scenes.id, plotSceneForIdentifier.sceneId),
            columns: { name: true },
          }),
        ]);
        name = `${plotForRelation?.name || t('plots_title')} — ${sceneForRelation?.name || translateStoryNoun(t, await vocabulary(), 'Scene', true)}`;
      }
      type = t('plot_scenes');
      break;
    case OperationLogEntityType.GalleryRelation:
      const galleryRelation = await db.query.galleryRelations.findFirst({
        where: and(
          eq(galleryRelations.id, relationId),
          eq(galleryRelations.storyId, storyId),
          eq(galleryRelations.isDeleted, false),
        ),
        columns: { galleryId: true, ownerId: true, ownerType: true },
      });
      if (galleryRelation) {
        const relatedGalleryForIdentifier = await db.query.galleries.findFirst({
          where: and(eq(galleries.id, galleryRelation.galleryId), eq(galleries.isDeleted, false)),
          columns: { title: true, fileName: true },
        });
        const relatedOwnerForGallery = await resolveRelationEntityName(
          db,
          galleryRelation.ownerType as OperationLogEntityType,
          galleryRelation.ownerId,
          storyId,
          t,
        );
        name = t('gallery_attributed_to_entity', {
          medianame:
            relatedGalleryForIdentifier?.title ||
            relatedGalleryForIdentifier?.fileName ||
            t('unknown_gallery'),
          entityname: relatedOwnerForGallery.name || t('unknown_entity'),
          entitytype: relatedOwnerForGallery.type || t('unknown_entity_type'),
        });
      }
      type = t('gallery_relation');
      break;
    case OperationLogEntityType.SeeAlsoRelation:
      const seeAlsoRelation = await db.query.seeAlsoRelations.findFirst({
        where: and(
          eq(seeAlsoRelations.id, relationId),
          eq(seeAlsoRelations.storyId, storyId),
          eq(seeAlsoRelations.isDeleted, false),
        ),
        columns: { entityAType: true, entityAId: true, entityBType: true, entityBId: true },
      });
      if (seeAlsoRelation) {
        const sideA = await resolveRelationEntityName(
          db,
          seeAlsoRelation.entityAType as OperationLogEntityType,
          seeAlsoRelation.entityAId,
          storyId,
          t,
        );
        const sideB = await resolveRelationEntityName(
          db,
          seeAlsoRelation.entityBType as OperationLogEntityType,
          seeAlsoRelation.entityBId,
          storyId,
          t,
        );
        name = `${sideA.name || t('unknown_entity')} (${sideA.type || t('unknown_entity_type')}) - ${sideB.name || t('unknown_entity')} (${sideB.type || t('unknown_entity_type')})`;
      }
      type = t('see_also_relation');
      break;
    case OperationLogEntityType.Stat:
      const relatedStat = await db.query.stats.findFirst({
        where: and(
          eq(stats.id, relationId),
          eq(stats.storyId, storyId),
          eq(stats.isDeleted, false),
        ),
        columns: { name: true },
      });
      name = relatedStat?.name;
      type = t('stat');
      break;
    case OperationLogEntityType.Mode:
      const relatedMode = await db.query.modes.findFirst({
        where: and(
          eq(modes.id, relationId),
          eq(modes.storyId, storyId),
          eq(modes.isDeleted, false),
        ),
        columns: { name: true, characterId: true },
      });
      if (relatedMode) {
        const relatedModeOwner = await db.query.characters.findFirst({
          where: and(eq(characters.id, relatedMode.characterId), eq(characters.isDeleted, false)),
          columns: { name: true },
        });
        name = t('mode_of_character', {
          modename: relatedMode.name,
          charactername: relatedModeOwner?.name || t('unknown_character'),
        });
      }
      type = t('mode');
      break;
    default:
      name = undefined;
      type = t('unknown_entity_type');
  }
  return { name, type };
}

export async function getEntityIdentifier(
  db: AppDrizzleClient,
  entityTypeString: string,
  entityId: string,
  storyId: string,
  t: TFunction,
): Promise<string | undefined> {
  const operationLogEntityType = ENTITY_LOOKUP_MAP[entityTypeString.toLowerCase()];
  if (operationLogEntityType === undefined) {
    throw new Error(`Invalid entityTypeString: ${entityTypeString}`);
  }

  const { name } = await resolveRelationEntityName(
    db,
    operationLogEntityType,
    entityId,
    storyId,
    t,
  );
  return name;
}
