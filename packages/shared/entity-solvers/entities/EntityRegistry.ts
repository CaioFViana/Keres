import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { chapterEntityHandler } from './ChapterEntityHandler';
import { choiceEntityHandler } from './ChoiceEntityHandler';
import type { EntityDomainHandler } from './contracts';
import type { EntityConflictReference } from './contracts';
import type { EntityExportReference } from './contracts';
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

export const CONFLICT_RELATION_ENTITY_TYPES = new Set(
  [...ENTITY_HANDLERS.values()]
    .filter((handler) => handler.isConflictRelation)
    .map((handler) => handler.entityType),
);

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

/** Locates a native suggestion field from the entity that declares it for advanced search. */
export function getSuggestionSource(
  source: string,
): { entityType: OperationLogEntityType; field: string } | undefined {
  for (const handler of ENTITY_HANDLERS.values()) {
    const field = handler.advancedSearch?.find(
      (candidate) => candidate.suggestionsSource === source,
    );
    if (field) return { entityType: handler.entityType, field: field.name };
  }
  return undefined;
}

export interface StoryExportReference extends EntityExportReference {
  collection: string;
  targetCollection: string;
}

export interface StoryExportCollection {
  entityType: OperationLogEntityType;
  collection: string;
}

/**
 * Every array carried by a portable story package is owned by an entity handler. Hosts use this
 * to verify that an added entity is exported, imported and tested on both sides of sync.
 */
export function getStoryExportCollections(): readonly StoryExportCollection[] {
  return [...ENTITY_HANDLERS.values()].flatMap((handler) =>
    handler.exportCollection
      ? [{ entityType: handler.entityType, collection: handler.exportCollection }]
      : [],
  );
}

/**
 * Stable parent-before-child order for the collections whose relationships are ordinary foreign
 * keys. Hosts still own SQL and special JSON remapping, but no importer needs to rediscover this
 * domain graph or accidentally insert a Chapter before its Arc.
 */
export function getStoryImportCollectionOrder(): readonly string[] {
  const collections = getStoryExportCollections().map(({ collection }) => collection);
  const dependencies = new Map(collections.map((collection) => [collection, new Set<string>()]));
  for (const { collection, targetCollection } of getStoryExportReferences()) {
    dependencies.get(collection)?.add(targetCollection);
  }

  const completed = new Set<string>();
  const visiting = new Set<string>();
  const ordered: string[] = [];
  const visit = (collection: string) => {
    if (completed.has(collection)) return;
    if (visiting.has(collection)) {
      throw new Error(`Portable story collections have a circular dependency at ${collection}.`);
    }
    visiting.add(collection);
    for (const dependency of dependencies.get(collection) ?? []) visit(dependency);
    visiting.delete(collection);
    completed.add(collection);
    ordered.push(collection);
  };
  for (const collection of collections) visit(collection);
  return ordered;
}

/** Story-bound entity types that require one client and one API sync handler. */
export function getStorySyncEntityTypes(): readonly OperationLogEntityType[] {
  return [...ENTITY_HANDLERS.values()]
    .filter((handler) => handler.syncable !== false)
    .map((handler) => handler.entityType);
}

/**
 * Fails during registration rather than silently treating a new entity as an unresolvable sync
 * conflict at runtime. Database-backed handlers remain host-owned; only their required coverage is
 * domain metadata.
 */
export function assertStorySyncHandlerCoverage(entityTypes: Iterable<string>): void {
  const registered = new Set(entityTypes);
  const expected = new Set(getStorySyncEntityTypes());
  const missing = [...expected].filter((type) => !registered.has(type));
  const unexpected = [...registered].filter(
    (type) => !expected.has(type as OperationLogEntityType),
  );
  if (missing.length || unexpected.length) {
    throw new Error(
      `Story sync handlers are out of sync with entity metadata. Missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}.`,
    );
  }
}

/** Foreign keys in a portable export, declared by their source and target entity handlers. */
export function getStoryExportReferences(): readonly StoryExportReference[] {
  return [...ENTITY_HANDLERS.values()].flatMap((handler) => {
    if (!handler.exportReferences?.length) return [];
    const collection = handler.exportCollection;
    if (!collection) {
      throw new Error(
        `${handler.entityType} declares export references without an export collection.`,
      );
    }
    return handler.exportReferences.map((reference) => {
      const targetCollection = ENTITY_HANDLERS.get(reference.targetEntityType)?.exportCollection;
      if (!targetCollection) {
        throw new Error(
          `${handler.entityType}.${reference.field} has no export collection for ${reference.targetEntityType}.`,
        );
      }
      return { ...reference, collection, targetCollection };
    });
  });
}

export function getEntityConflictLabelKey(entityType: string): string {
  return (
    getEntityDomainHandler(entityType as OperationLogEntityType)?.conflictLabelKey ?? entityType
  );
}

export function isConflictRelationEntity(entityType: string): boolean {
  return getEntityDomainHandler(entityType as OperationLogEntityType)?.isConflictRelation ?? false;
}

/** Fixed references come from the generic handler contract; relations add polymorphic pairs locally. */
export function getEntityConflictReferences(
  entityType: string,
): readonly EntityConflictReference[] {
  const handler = getEntityDomainHandler(entityType as OperationLogEntityType);
  if (!handler) return [];
  const fixed = Object.entries(handler.referenceFields ?? {}).map(([field, target]) => ({
    kind: 'fixed' as const,
    field,
    entityType: target,
  }));
  return [...fixed, ...(handler.conflictReferences ?? [])];
}

export interface EntityRowReference {
  entityType: string;
  id: string;
}

/**
 * Reads the references declared by an entity handler from one untyped persisted row. This keeps
 * hosts from recreating a relation switch merely to batch-load labels for recovery or audit UIs.
 */
export function getEntityRowReferences(
  entityType: string,
  row: Record<string, unknown>,
): readonly EntityRowReference[] {
  const stringAt = (field: string): string | undefined => {
    const value = row[field];
    return typeof value === 'string' && value.trim() ? value : undefined;
  };

  return getEntityConflictReferences(entityType).flatMap((reference) => {
    if (reference.kind === 'fixed') {
      const id = stringAt(reference.field);
      return id ? [{ entityType: reference.entityType, id }] : [];
    }

    const id = stringAt(reference.idField);
    const targetType = stringAt(reference.typeField);
    return id && targetType ? [{ entityType: targetType, id }] : [];
  });
}
