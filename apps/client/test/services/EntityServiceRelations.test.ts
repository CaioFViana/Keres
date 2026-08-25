/**
 * @jest-environment node
 */
import { AttributeType, OperationLogEntityType } from '@keres/shared';
import type { TFunction } from 'i18next';
import * as schema from '../../src/db/schema';
import { EntityService } from '../../src/services/EntityService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');
const base = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };
const t = ((key: string) => key) as unknown as TFunction;

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: 'local-user',
    title: 'A Queda',
    type: 'linear',
    favoriteBehavior: 'individual',
    ...base,
  });
});

afterEach(() => database.close());

const nameOf = (entityType: OperationLogEntityType, entityId: string) =>
  EntityService.getEntityName(database.db, entityType, entityId, STORY_ID, t);

async function seedScene(id: string, name: string): Promise<void> {
  await database.db.insert(schema.scenes).values({
    id,
    storyId: STORY_ID,
    chapterId: 'chapter',
    locationId: 'location',
    name,
    index: 1,
    ...base,
  });
}

/** Labels here feed the operation history, so relation/entity indirection must remain readable. */
describe('EntityService relationship labels', () => {
  it('uses a gallery title and falls back to its filename', async () => {
    await database.db.insert(schema.galleries).values([
      {
        id: 'portrait',
        storyId: STORY_ID,
        mediaType: 'image',
        mimeType: 'image/png',
        fileName: 'portrait.png',
        hash: 'hash-portrait',
        sizeBytes: 42,
        title: 'Retrato da Mira',
        ...base,
      },
      {
        id: 'map',
        storyId: STORY_ID,
        mediaType: 'image',
        mimeType: 'image/png',
        fileName: 'mapa.png',
        hash: 'hash-map',
        sizeBytes: 42,
        title: null,
        ...base,
      },
    ]);

    await expect(nameOf(OperationLogEntityType.Gallery, 'portrait')).resolves.toBe(
      'gallery - Retrato da Mira',
    );
    await expect(nameOf(OperationLogEntityType.Gallery, 'map')).resolves.toBe('gallery - mapa.png');
  });

  it('names both participants of a character relation', async () => {
    await database.db.insert(schema.characters).values([
      { id: 'mira', storyId: STORY_ID, name: 'Mira', ...base },
      { id: 'oren', storyId: STORY_ID, name: 'Oren', ...base },
    ]);
    await database.db.insert(schema.characterRelations).values({
      id: 'relation',
      storyId: STORY_ID,
      character1Id: 'mira',
      character2Id: 'oren',
      relationType: 'allies',
      ...base,
    });

    await expect(nameOf(OperationLogEntityType.CharacterRelation, 'relation')).resolves.toBe(
      'character_relation - Mira - Oren relation',
    );
  });

  it('distinguishes a containment location relation from a connection', async () => {
    await database.db.insert(schema.locations).values([
      { id: 'city', storyId: STORY_ID, name: 'Cidade', ...base },
      { id: 'harbor', storyId: STORY_ID, name: 'Porto', ...base },
    ]);
    await database.db.insert(schema.locationRelations).values({
      id: 'contains',
      storyId: STORY_ID,
      locationAId: 'city',
      locationBId: 'harbor',
      relationType: 'contains',
      ...base,
    });

    await expect(nameOf(OperationLogEntityType.LocationRelation, 'contains')).resolves.toBe(
      'location_relation - location_contains_location',
    );
  });

  it('resolves a gallery relation through both the media and its owner', async () => {
    await database.db.insert(schema.characters).values({
      id: 'mira',
      storyId: STORY_ID,
      name: 'Mira',
      ...base,
    });
    await database.db.insert(schema.galleries).values({
      id: 'portrait',
      storyId: STORY_ID,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'portrait.png',
      hash: 'hash-portrait',
      sizeBytes: 42,
      title: 'Retrato',
      ...base,
    });
    await database.db.insert(schema.galleryRelations).values({
      id: 'gallery-link',
      storyId: STORY_ID,
      galleryId: 'portrait',
      ownerId: 'mira',
      ownerType: 'Character',
      ...base,
    });

    await expect(nameOf(OperationLogEntityType.GalleryRelation, 'gallery-link')).resolves.toBe(
      'gallery_relation - gallery_attributed_to_entity',
    );
  });

  it('decodes an attribute value before formatting its owner label', async () => {
    await database.db.insert(schema.characters).values({
      id: 'mira',
      storyId: STORY_ID,
      name: 'Mira',
      ...base,
    });
    await database.db.insert(schema.storySchemaFields).values({
      id: 'rank-field',
      storyId: STORY_ID,
      entityType: 'Character',
      name: 'Prestígio',
      key: 'rank',
      type: AttributeType.NUMBER,
      isRequired: false,
      order: 0,
      ...base,
    });
    await database.db.insert(schema.attributeValues).values({
      id: 'rank-value',
      storyId: STORY_ID,
      entityType: 'Character',
      entityId: 'mira',
      fieldId: 'rank-field',
      value: '12',
      ...base,
    });

    await expect(nameOf(OperationLogEntityType.AttributeValue, 'rank-value')).resolves.toBe(
      'custom_attribute_value - attribute_value_attributed_to_entity',
    );
  });

  it('identifies a choice by the scene where it originates', async () => {
    await seedScene('market', 'Mercado');
    await database.db.insert(schema.choices).values({
      id: 'leave-market',
      storyId: STORY_ID,
      sceneId: 'market',
      nextSceneId: 'road',
      text: 'Seguir pela estrada',
      ...base,
    });

    await expect(nameOf(OperationLogEntityType.Choice, 'leave-market')).resolves.toBe(
      'choice - from_scene: Mercado - Seguir pela estrada',
    );
  });

  it('names an item journey through both its item and destination scene', async () => {
    await seedScene('tower', 'Torre');
    await database.db.insert(schema.items).values({
      id: 'compass',
      storyId: STORY_ID,
      name: 'Bússola',
      ...base,
    });
    await database.db.insert(schema.itemJourneys).values({
      id: 'journey',
      storyId: STORY_ID,
      itemId: 'compass',
      sceneId: 'tower',
      newState: 'found',
      ...base,
    });

    await expect(nameOf(OperationLogEntityType.ItemJourney, 'journey')).resolves.toBe(
      'item_journey - Bússola showed_in_scene Torre',
    );
  });

  it('formats a character appearance as a character-to-scene relation', async () => {
    await seedScene('tower', 'Torre');
    await database.db.insert(schema.characters).values({
      id: 'mira',
      storyId: STORY_ID,
      name: 'Mira',
      ...base,
    });
    await database.db.insert(schema.characterScenes).values({
      id: 'appearance',
      storyId: STORY_ID,
      characterId: 'mira',
      sceneId: 'tower',
      ...base,
    });

    await expect(nameOf(OperationLogEntityType.CharacterScene, 'appearance')).resolves.toBe(
      'character_scene_relation - character_attributed_to_scene',
    );
  });

  it('formats a Note relation through the note and its linked entity', async () => {
    await database.db.insert(schema.notes).values({
      id: 'clue',
      storyId: STORY_ID,
      title: 'Pista',
      ...base,
    });
    await database.db.insert(schema.locations).values({
      id: 'tower',
      storyId: STORY_ID,
      name: 'Torre',
      ...base,
    });
    await database.db.insert(schema.noteRelations).values({
      id: 'note-link',
      storyId: STORY_ID,
      noteId: 'clue',
      relationId: 'tower',
      relationType: 'Location',
      ...base,
    });

    await expect(nameOf(OperationLogEntityType.NoteRelation, 'note-link')).resolves.toBe(
      'note_relation - note_attributed_to_entity',
    );
  });

  it('formats a Tag relation through the tag and its linked entity', async () => {
    await database.db.insert(schema.tags).values({
      id: 'mystery',
      storyId: STORY_ID,
      name: 'Mistério',
      ...base,
    });
    await database.db.insert(schema.characters).values({
      id: 'mira',
      storyId: STORY_ID,
      name: 'Mira',
      ...base,
    });
    await database.db.insert(schema.tagRelations).values({
      id: 'tag-link',
      storyId: STORY_ID,
      tagId: 'mystery',
      relationId: 'mira',
      relationType: 'Character',
      ...base,
    });

    await expect(nameOf(OperationLogEntityType.TagRelation, 'tag-link')).resolves.toBe(
      'tag_relation - tag_attributed_to_entity',
    );
  });
});

/**
 * `getEntityIdentifier` (the public resolver used by `OperationLogDetailScreen` and, after
 * this change, by the sync conflict summary layer) delegates to
 * `_resolveRelationEntityName` - a switch separate from the one `getEntityName` uses, which until now
 * covered only part of the relations. With no coverage for the other 6 types, it returned
 * `undefined` even with the row existing in the database.
 */
describe('EntityService.getEntityIdentifier', () => {
  const identifierOf = (entityTypeString: string, entityId: string) =>
    EntityService.getEntityIdentifier(database.db, entityTypeString, entityId, STORY_ID, t);

  it('resolves a character relation by both participants', async () => {
    await database.db.insert(schema.characters).values([
      { id: 'mira', storyId: STORY_ID, name: 'Mira', ...base },
      { id: 'oren', storyId: STORY_ID, name: 'Oren', ...base },
    ]);
    await database.db.insert(schema.characterRelations).values({
      id: 'relation',
      storyId: STORY_ID,
      character1Id: 'mira',
      character2Id: 'oren',
      relationType: 'allies',
      ...base,
    });

    await expect(identifierOf('characterrelation', 'relation')).resolves.toBe(
      'Mira - Oren relation',
    );
  });

  it('resolves a location relation', async () => {
    await database.db.insert(schema.locations).values([
      { id: 'city', storyId: STORY_ID, name: 'Cidade', ...base },
      { id: 'harbor', storyId: STORY_ID, name: 'Porto', ...base },
    ]);
    await database.db.insert(schema.locationRelations).values({
      id: 'contains',
      storyId: STORY_ID,
      locationAId: 'city',
      locationBId: 'harbor',
      relationType: 'contains',
      ...base,
    });

    await expect(identifierOf('locationrelation', 'contains')).resolves.toBe(
      'location_contains_location',
    );
  });

  it('resolves a tag relation through the tag and its linked entity', async () => {
    await database.db.insert(schema.tags).values({
      id: 'mystery',
      storyId: STORY_ID,
      name: 'Mistério',
      ...base,
    });
    await database.db.insert(schema.characters).values({
      id: 'mira',
      storyId: STORY_ID,
      name: 'Mira',
      ...base,
    });
    await database.db.insert(schema.tagRelations).values({
      id: 'tag-link',
      storyId: STORY_ID,
      tagId: 'mystery',
      relationId: 'mira',
      relationType: 'Character',
      ...base,
    });

    await expect(identifierOf('tagrelation', 'tag-link')).resolves.toBe('tag_attributed_to_entity');
  });

  it('resolves a character-to-scene relation', async () => {
    await seedScene('tower', 'Torre');
    await database.db.insert(schema.characters).values({
      id: 'mira',
      storyId: STORY_ID,
      name: 'Mira',
      ...base,
    });
    await database.db.insert(schema.characterScenes).values({
      id: 'appearance',
      storyId: STORY_ID,
      characterId: 'mira',
      sceneId: 'tower',
      ...base,
    });

    await expect(identifierOf('characterscene', 'appearance')).resolves.toBe(
      'character_attributed_to_scene',
    );
  });

  it('resolves a gallery relation through both the media and its owner', async () => {
    await database.db.insert(schema.characters).values({
      id: 'mira',
      storyId: STORY_ID,
      name: 'Mira',
      ...base,
    });
    await database.db.insert(schema.galleries).values({
      id: 'portrait',
      storyId: STORY_ID,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'portrait.png',
      hash: 'hash-portrait',
      sizeBytes: 42,
      title: 'Retrato',
      ...base,
    });
    await database.db.insert(schema.galleryRelations).values({
      id: 'gallery-link',
      storyId: STORY_ID,
      galleryId: 'portrait',
      ownerId: 'mira',
      ownerType: 'Character',
      ...base,
    });

    await expect(identifierOf('galleryrelation', 'gallery-link')).resolves.toBe(
      'gallery_attributed_to_entity',
    );
  });

  it('resolves a see-also relation through both sides', async () => {
    await database.db
      .insert(schema.characters)
      .values({ id: 'mira', storyId: STORY_ID, name: 'Mira', ...base });
    await database.db
      .insert(schema.locations)
      .values({ id: 'tower', storyId: STORY_ID, name: 'Torre', ...base });
    await database.db.insert(schema.seeAlsoRelations).values({
      id: 'see-also',
      storyId: STORY_ID,
      entityAType: 'Character',
      entityAId: 'mira',
      entityBType: 'Location',
      entityBId: 'tower',
      ...base,
    });

    await expect(identifierOf('seealsorelation', 'see-also')).resolves.toBe(
      'Mira (character) - Torre (location)',
    );
  });

  it('still resolves a note relation, which already worked before this fix', async () => {
    await database.db
      .insert(schema.notes)
      .values({ id: 'clue', storyId: STORY_ID, title: 'Pista', ...base });
    await database.db
      .insert(schema.locations)
      .values({ id: 'tower', storyId: STORY_ID, name: 'Torre', ...base });
    await database.db.insert(schema.noteRelations).values({
      id: 'note-link',
      storyId: STORY_ID,
      noteId: 'clue',
      relationId: 'tower',
      relationType: 'Location',
      ...base,
    });

    await expect(identifierOf('noterelation', 'note-link')).resolves.toBe(
      'note_attributed_to_entity_short',
    );
  });

  it('throws for an unrecognized entity type string', async () => {
    await expect(identifierOf('not-a-real-type', 'x')).rejects.toThrow('Invalid entityTypeString');
  });
});
