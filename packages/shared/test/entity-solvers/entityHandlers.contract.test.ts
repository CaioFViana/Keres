import { describe, expect, it } from 'vitest';
import type { EntitySolverContext } from '../../entity-solvers/contracts';
import { resolveAdvancedOperationLogEntityName } from '../../entity-solvers/advancedOperationLogEntitySolver';
import { resolveBasicOperationLogEntityName } from '../../entity-solvers/basicOperationLogEntitySolver';
import {
  resolveCompactEntityLabel,
  resolveCompactEntityName,
} from '../../entity-solvers/compactEntityName';
import { resolveEntityReference } from '../../entity-solvers/EntityReferenceResolver';
import {
  getEntityDomainHandler,
  getEntityReferenceFieldType,
  getSuggestionSource,
  summarizeEntityConflictRelation,
} from '../../entity-solvers/entities/EntityRegistry';
import { summarizeEntityPreview } from '../../entity-solvers/boardEntitySummary';
import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';

const row = {
  id: 'entity-id',
  name: 'Entity name',
  title: 'Entity title',
  summary: 'Summary',
  description: 'Description',
  details: 'Details',
  extraNotes: 'Notes',
  relationType: 'ally',
  character1Id: 'character-1',
  character2Id: 'character-2',
  characterId: 'character-1',
  sceneId: 'scene-1',
  chapterId: 'chapter-1',
  locationId: 'location-1',
  itemId: 'item-1',
  noteId: 'note-1',
  tagId: 'tag-1',
  galleryId: 'gallery-1',
  plotId: 'plot-1',
  routeId: 'route-1',
  choiceId: 'choice-1',
  statId: 'stat-1',
  relationId: 'relation-1',
  relationTypeId: OperationLogEntityType.Scene,
  entityId: 'entity-id',
  entityType: OperationLogEntityType.Scene,
  sourceId: 'source-1',
  targetId: 'target-1',
  type: 'event',
  value: 'Value',
  label: 'Label',
  content: 'Content',
  text: 'Text',
  isFavorite: true,
} as Record<string, unknown>;

const context: EntitySolverContext = {
  storyId: 'story-1',
  read: async () => row,
  translate: (key, values) => `${key}${values ? `:${Object.values(values).join(',')}` : ''}`,
  noun: async (type) => `noun:${type}`,
  fromNoun: async (type) => `from:${type}`,
  unknownNoun: async (type) => `unknown:${type}`,
};

const missingContext: EntitySolverContext = {
  ...context,
  read: async () => undefined,
};

const handlers = Object.values(OperationLogEntityType)
  .map((entityType) => getEntityDomainHandler(entityType))
  .filter((handler): handler is NonNullable<typeof handler> => Boolean(handler));

describe('entity handler contract', () => {
  it('registers every operation-log entity exactly once', () => {
    expect(handlers).toHaveLength(Object.values(OperationLogEntityType).length);
    expect(new Set(handlers.map((handler) => handler.entityType))).toHaveLength(handlers.length);
  });

  it('executes each handler through every public host facade', async () => {
    for (const handler of handlers) {
      const entityType = handler.entityType;
      await expect(resolveEntityReference(context, entityType, 'entity-id')).resolves.toMatchObject(
        {
          type: expect.any(String),
        },
      );
      await expect(
        resolveBasicOperationLogEntityName(context, entityType, 'entity-id'),
      ).resolves.toEqual(expect.anything());
      await expect(
        resolveAdvancedOperationLogEntityName(context, entityType, 'entity-id'),
      ).resolves.toEqual(expect.anything());
      const compactName = await resolveCompactEntityName(context, entityType, 'entity-id');
      expect(compactName === undefined || typeof compactName === 'string').toBe(true);
      await expect(resolveCompactEntityLabel(context, entityType, 'entity-id')).resolves.toEqual(
        expect.any(String),
      );

      if (handler.summarizePreview) {
        expect(summarizeEntityPreview(entityType, row)).toMatchObject({
          title: expect.any(String),
        });
      }
      if (handler.summarizeConflictRelation) {
        expect(
          summarizeEntityConflictRelation(entityType, row, {
            nameOf: (type, id) => `${type}:${id}`,
            translate: context.translate,
            unknown: 'unknown',
          }),
        ).toMatchObject({ title: expect.any(String), detail: expect.any(String) });
      }
      for (const [field, target] of Object.entries(handler.referenceFields ?? {})) {
        expect(getEntityReferenceFieldType(field)).toBe(target);
      }
      for (const field of handler.advancedSearch ?? []) {
        if (field.suggestionsSource) {
          expect(getSuggestionSource(field.suggestionsSource)).toMatchObject({ field: field.name });
        }
      }
    }
  });

  it('keeps every handler safe when a referenced row is missing', async () => {
    for (const handler of handlers) {
      const entityType = handler.entityType;
      await resolveEntityReference(missingContext, entityType, 'missing-id');
      await resolveBasicOperationLogEntityName(missingContext, entityType, 'missing-id');
      await resolveAdvancedOperationLogEntityName(missingContext, entityType, 'missing-id');
      await resolveCompactEntityName(missingContext, entityType, 'missing-id');
      await expect(resolveCompactEntityLabel(missingContext, entityType, '')).resolves.toBe('?');

      if (handler.summarizePreview) {
        expect(summarizeEntityPreview(entityType, {})).toMatchObject({ title: expect.any(String) });
      }
      if (handler.summarizeConflictRelation) {
        expect(
          summarizeEntityConflictRelation(
            entityType,
            {},
            {
              nameOf: (_type, _id) => 'unknown',
              translate: context.translate,
              unknown: 'unknown',
            },
          ),
        ).toMatchObject({ title: expect.any(String), detail: expect.any(String) });
      }
    }
  });
});
