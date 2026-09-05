import { describe, expect, it } from 'vitest';
import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import {
  summarizeBoardEntity,
  summarizeEntityPreview,
} from '../../entity-solvers/boardEntitySummary';
import {
  getStoryExportCollections,
  getStoryExportReferences,
  getStoryImportCollectionOrder,
  getStorySyncEntityTypes,
  getEntityRowReferences,
} from '../../entity-solvers/entities/EntityRegistry';
import { FullStoryExportSchema } from '../../schemas/FullStorySchemas';

const isArraySchema = (schema: unknown): boolean => {
  let current = schema as { def: { type: string; innerType?: unknown } };
  while (current.def.type === 'optional') {
    current = current.def.innerType as typeof current;
  }
  return current.def.type === 'array';
};

describe('entity previews', () => {
  it('keeps a chapter summary and notes available to a list', () => {
    expect(
      summarizeEntityPreview(OperationLogEntityType.Chapter, {
        name: 'Prólogo',
        summary: 'A chegada.',
        extraNotes: 'Revisar o ritmo.',
      }),
    ).toEqual({
      title: 'Prólogo',
      primaryDetail: 'A chegada.',
      secondaryDetail: 'Revisar o ritmo.',
    });
  });

  it('keeps the existing board fallback to notes when a chapter has no summary', () => {
    expect(
      summarizeBoardEntity('Chapter', {
        name: 'Prólogo',
        summary: null,
        extraNotes: 'Revisar o ritmo.',
      }),
    ).toEqual({ title: 'Prólogo', details: 'Revisar o ritmo.' });
  });

  it('uses the entity-owned preview for a list-only Plot', () => {
    expect(
      summarizeEntityPreview(OperationLogEntityType.Plot, {
        name: 'Conspiração',
        details: 'A trama política.',
      }),
    ).toEqual({
      title: 'Conspiração',
      primaryDetail: 'A trama política.',
      secondaryDetail: null,
    });
  });

  it('derives every portable foreign key from the entity handlers', () => {
    expect(getStoryExportReferences()).toHaveLength(38);
    expect(getStoryExportReferences()).toContainEqual({
      collection: 'scenes',
      field: 'chapterId',
      targetEntityType: OperationLogEntityType.Chapter,
      targetCollection: 'chapters',
      required: true,
    });
  });

  it('assigns every portable collection to exactly one entity handler', () => {
    const packageFieldsThatAreCollections = Object.entries(FullStoryExportSchema.shape)
      .filter(([, schema]) => isArraySchema(schema))
      .map(([field]) => field)
      .sort();

    expect(
      getStoryExportCollections()
        .map(({ collection }) => collection)
        .sort(),
    ).toEqual(packageFieldsThatAreCollections);
  });

  it('puts foreign-key targets before their portable dependents on import', () => {
    const order = getStoryImportCollectionOrder();
    for (const { collection, targetCollection } of getStoryExportReferences()) {
      expect(order.indexOf(targetCollection)).toBeLessThan(order.indexOf(collection));
    }
  });

  it('keeps non-story records out of the synchronization registry', () => {
    expect(getStorySyncEntityTypes()).not.toContain(OperationLogEntityType.User);
    expect(getStorySyncEntityTypes()).not.toContain(OperationLogEntityType.OperationLog);
    expect(getStorySyncEntityTypes()).toContain(OperationLogEntityType.StoryArc);
  });

  it('reads fixed and polymorphic row references from the owning handler', () => {
    expect(
      getEntityRowReferences(OperationLogEntityType.TagRelation, {
        tagId: 'tag-1',
        relationId: 'scene-1',
        relationType: OperationLogEntityType.Scene,
      }),
    ).toEqual([
      { entityType: OperationLogEntityType.Tag, id: 'tag-1' },
      { entityType: OperationLogEntityType.Scene, id: 'scene-1' },
    ]);
    expect(
      getEntityRowReferences(OperationLogEntityType.CharacterScene, {
        characterId: 'character-1',
        sceneId: '   ',
      }),
    ).toEqual([{ entityType: OperationLogEntityType.Character, id: 'character-1' }]);
  });
});
