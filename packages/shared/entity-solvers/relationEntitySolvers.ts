import { OperationLogEntityType } from '../metadata/OperationLogEntityType';
import type { EntityReference, EntityReferenceSolver, EntitySolverContext } from './contracts';

const stringValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const related = async (
  resolve: EntityReferenceSolver,
  context: EntitySolverContext,
  type: OperationLogEntityType,
  id: string | undefined,
) => (id ? resolve(context, type, id) : { name: undefined, type: undefined });

const MISSING_ROW_TYPE_KEYS: Partial<Record<OperationLogEntityType, string>> = {
  [OperationLogEntityType.RouteStep]: 'route_step',
  [OperationLogEntityType.ItemJourney]: 'item_journey',
  [OperationLogEntityType.NoteRelation]: 'note_relation',
  [OperationLogEntityType.CharacterRelation]: 'character_relation',
  [OperationLogEntityType.LocationRelation]: 'location_relation',
  [OperationLogEntityType.TagRelation]: 'tag_relation',
  [OperationLogEntityType.CharacterScene]: 'character_scene_relation',
  [OperationLogEntityType.PlotScene]: 'plot_scenes',
  [OperationLogEntityType.GalleryRelation]: 'gallery_relation',
  [OperationLogEntityType.SeeAlsoRelation]: 'see_also_relation',
};

/** Solvers whose label is made from other entities rather than one display column. */
export async function resolveRelationEntityReference(
  context: EntitySolverContext,
  entityType: OperationLogEntityType,
  entityId: string,
  resolve: EntityReferenceSolver,
): Promise<EntityReference | undefined> {
  const row = await context.read(entityType, entityId);
  if (!row) {
    const type = MISSING_ROW_TYPE_KEYS[entityType];
    return type ? { name: undefined, type: context.translate(type) } : undefined;
  }

  switch (entityType) {
    case OperationLogEntityType.RouteStep: {
      const [route, scene] = await Promise.all([
        related(resolve, context, OperationLogEntityType.Route, stringValue(row, 'routeId')),
        related(resolve, context, OperationLogEntityType.Scene, stringValue(row, 'sceneId')),
      ]);
      return {
        name: `${route.name ?? context.translate('unknown_entity')} · ${row.position ?? '?'}: ${scene.name ?? (await context.unknownNoun(OperationLogEntityType.Scene))}`,
        type: context.translate('route_step'),
      };
    }
    case OperationLogEntityType.ItemJourney: {
      const [item, scene] = await Promise.all([
        related(resolve, context, OperationLogEntityType.Item, stringValue(row, 'itemId')),
        related(resolve, context, OperationLogEntityType.Scene, stringValue(row, 'sceneId')),
      ]);
      return {
        name: `${item.name ?? (await context.unknownNoun(OperationLogEntityType.Item))} ${context.translate('showed_in_scene')} ${scene.name ?? (await context.unknownNoun(OperationLogEntityType.Scene))}`,
        type: context.translate('item_journey'),
      };
    }
    case OperationLogEntityType.NoteRelation: {
      const [note, target] = await Promise.all([
        related(resolve, context, OperationLogEntityType.Note, stringValue(row, 'noteId')),
        related(
          resolve,
          context,
          stringValue(row, 'relationType') as OperationLogEntityType,
          stringValue(row, 'relationId'),
        ),
      ]);
      return {
        name: context.translate('note_attributed_to_entity_short', {
          notename: note.name ?? context.translate('unknown_note'),
          entityname: target.name ?? context.translate('unknown_entity'),
          entitytype: target.type ?? context.translate('unknown_entity_type'),
        }),
        type: context.translate('note_relation'),
      };
    }
    case OperationLogEntityType.CharacterRelation: {
      const [first, second] = await Promise.all([
        related(
          resolve,
          context,
          OperationLogEntityType.Character,
          stringValue(row, 'character1Id'),
        ),
        related(
          resolve,
          context,
          OperationLogEntityType.Character,
          stringValue(row, 'character2Id'),
        ),
      ]);
      return {
        name: `${first.name ?? context.translate('unknown_character')} - ${second.name ?? context.translate('unknown_character')} ${context.translate('relation')}`,
        type: context.translate('character_relation'),
      };
    }
    case OperationLogEntityType.LocationRelation: {
      const [first, second] = await Promise.all([
        related(resolve, context, OperationLogEntityType.Location, stringValue(row, 'locationAId')),
        related(resolve, context, OperationLogEntityType.Location, stringValue(row, 'locationBId')),
      ]);
      return {
        name:
          stringValue(row, 'relationType') === 'contains'
            ? context.translate('location_contains_location', {
                parentName: first.name ?? context.translate('unknown_location'),
                childName: second.name ?? context.translate('unknown_location'),
              })
            : context.translate('location_connected_to_location', {
                locationAName: first.name ?? context.translate('unknown_location'),
                locationBName: second.name ?? context.translate('unknown_location'),
              }),
        type: context.translate('location_relation'),
      };
    }
    case OperationLogEntityType.TagRelation: {
      const [tag, target] = await Promise.all([
        related(resolve, context, OperationLogEntityType.Tag, stringValue(row, 'tagId')),
        related(
          resolve,
          context,
          stringValue(row, 'relationType') as OperationLogEntityType,
          stringValue(row, 'relationId'),
        ),
      ]);
      return {
        name: context.translate('tag_attributed_to_entity', {
          tagname: tag.name ?? context.translate('unknown_tag'),
          entityname: target.name ?? context.translate('unknown_entity'),
          entitytype: target.type ?? context.translate('unknown_entity_type'),
        }),
        type: context.translate('tag_relation'),
      };
    }
    case OperationLogEntityType.CharacterScene: {
      const [character, scene] = await Promise.all([
        related(
          resolve,
          context,
          OperationLogEntityType.Character,
          stringValue(row, 'characterId'),
        ),
        related(resolve, context, OperationLogEntityType.Scene, stringValue(row, 'sceneId')),
      ]);
      return {
        name: context.translate('character_attributed_to_scene', {
          characterName: character.name ?? context.translate('unknown_character'),
          sceneName: scene.name ?? (await context.unknownNoun(OperationLogEntityType.Scene)),
        }),
        type: context.translate('character_scene_relation'),
      };
    }
    case OperationLogEntityType.PlotScene: {
      const [plot, scene] = await Promise.all([
        related(resolve, context, OperationLogEntityType.Plot, stringValue(row, 'plotId')),
        related(resolve, context, OperationLogEntityType.Scene, stringValue(row, 'sceneId')),
      ]);
      return {
        name: `${plot.name ?? context.translate('plots_title')} — ${scene.name ?? (await context.noun(OperationLogEntityType.Scene, true))}`,
        type: context.translate('plot_scenes'),
      };
    }
    case OperationLogEntityType.GalleryRelation: {
      const [gallery, owner] = await Promise.all([
        related(resolve, context, OperationLogEntityType.Gallery, stringValue(row, 'galleryId')),
        related(
          resolve,
          context,
          stringValue(row, 'ownerType') as OperationLogEntityType,
          stringValue(row, 'ownerId'),
        ),
      ]);
      return {
        name: context.translate('gallery_attributed_to_entity', {
          medianame: gallery.name ?? context.translate('unknown_gallery'),
          entityname: owner.name ?? context.translate('unknown_entity'),
          entitytype: owner.type ?? context.translate('unknown_entity_type'),
        }),
        type: context.translate('gallery_relation'),
      };
    }
    case OperationLogEntityType.SeeAlsoRelation: {
      const [first, second] = await Promise.all([
        related(
          resolve,
          context,
          stringValue(row, 'entityAType') as OperationLogEntityType,
          stringValue(row, 'entityAId'),
        ),
        related(
          resolve,
          context,
          stringValue(row, 'entityBType') as OperationLogEntityType,
          stringValue(row, 'entityBId'),
        ),
      ]);
      return {
        name: `${first.name ?? context.translate('unknown_entity')} (${first.type ?? context.translate('unknown_entity_type')}) - ${second.name ?? context.translate('unknown_entity')} (${second.type ?? context.translate('unknown_entity_type')})`,
        type: context.translate('see_also_relation'),
      };
    }
    default:
      return undefined;
  }
}
