import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import {
  chapters,
  characters,
  choiceCheckGroups,
  choices,
  galleries,
  items,
  locations,
  notes,
  scenes,
  stories,
  storySchemaFields,
  tags,
  users,
  worldRules,
} from '../../src/db/schema';
import {
  type EnrichableDeletedRow,
  enrichDeletedDisplayNames,
  enrichOperationLogNames,
} from '../../src/services/AdminRecoveryDisplayNames';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

const ids = {
  user: '',
  story: '',
  chapter: '',
  location: '',
  scene: '',
  otherScene: '',
  choice: '',
  choiceGroup: '',
  characterA: '',
  characterB: '',
  item: '',
  tag: '',
  note: '',
  worldRule: '',
  field: '',
  gallery: '',
  galleryNoTitle: '',
};

/** An id that does not exist in the database, to exercise the fallback label. */
const MISSING_ID = '01JQMISSINGMISSINGMISSING';

function deleted(
  entityType: string,
  id: string,
  row: Record<string, unknown>,
  name: string | null = null,
): EnrichableDeletedRow {
  return { entityType, id, storyId: ids.story, name, row };
}

async function label(item: EnrichableDeletedRow): Promise<string | null> {
  const { names } = await enrichDeletedDisplayNames([item]);
  return names.get(`${item.entityType}:${item.id}`) ?? null;
}

beforeEach(async () => {
  await truncateAll();
  for (const key of Object.keys(ids) as Array<keyof typeof ids>) ids[key] = newId();

  await db
    .insert(users)
    .values({ id: ids.user, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db.insert(stories).values({
    id: ids.story,
    userId: ids.user,
    title: 'A Queda',
    type: 'branching',
    version: 1,
    isDeleted: false,
  } as never);
  await db
    .insert(chapters)
    .values({ id: ids.chapter, storyId: ids.story, name: 'Capítulo 1', index: 1 } as never);
  await db
    .insert(locations)
    .values({ id: ids.location, storyId: ids.story, name: 'O Porto' } as never);
  await db.insert(scenes).values([
    {
      id: ids.scene,
      storyId: ids.story,
      chapterId: ids.chapter,
      locationId: ids.location,
      name: 'A chegada',
      index: 1,
    },
    {
      id: ids.otherScene,
      storyId: ids.story,
      chapterId: ids.chapter,
      locationId: ids.location,
      name: 'A partida',
      index: 1,
    },
  ] as never);
  await db.insert(choices).values({
    id: ids.choice,
    storyId: ids.story,
    sceneId: ids.scene,
    nextSceneId: ids.otherScene,
    text: 'Subir a bordo',
  } as never);
  await db.insert(choiceCheckGroups).values({
    id: ids.choiceGroup,
    storyId: ids.story,
    choiceId: ids.choice,
  } as never);
  await db.insert(characters).values([
    { id: ids.characterA, storyId: ids.story, name: 'Lia' },
    { id: ids.characterB, storyId: ids.story, name: 'Rui' },
  ] as never);
  await db.insert(items).values({ id: ids.item, storyId: ids.story, name: 'A bússola' } as never);
  await db.insert(tags).values({ id: ids.tag, storyId: ids.story, name: 'mar' } as never);
  await db.insert(notes).values({ id: ids.note, storyId: ids.story, title: 'Pesquisa' } as never);
  await db
    .insert(worldRules)
    .values({ id: ids.worldRule, storyId: ids.story, title: 'A maré' } as never);
  await db.insert(storySchemaFields).values({
    id: ids.field,
    storyId: ids.story,
    entityType: 'Character',
    name: 'Patente',
    key: 'rank',
    type: 'text',
  } as never);
  await db.insert(galleries).values([
    {
      id: ids.gallery,
      storyId: ids.story,
      title: 'O navio',
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'navio.png',
      hash: 'h1',
    },
    {
      id: ids.galleryNoTitle,
      storyId: ids.story,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'porto.png',
      hash: 'h2',
    },
  ] as never);
});

describe('enrichDeletedDisplayNames', () => {
  it('composes a label for every relation-like tombstone', async () => {
    const cases: Array<[EnrichableDeletedRow, string]> = [
      [
        deleted('CharacterRelation', newId(), {
          character1Id: ids.characterA,
          character2Id: ids.characterB,
          relationType: 'irmãos',
        }),
        'Lia ↔ Rui · irmãos',
      ],
      [
        deleted('LocationRelation', newId(), {
          locationAId: ids.location,
          locationBId: ids.location,
          relationType: 'contém',
        }),
        'O Porto → O Porto · contém',
      ],
      [
        deleted('CharacterScene', newId(), {
          characterId: ids.characterA,
          sceneId: ids.scene,
        }),
        'Lia @ A chegada',
      ],
      [
        deleted('ItemJourney', newId(), { itemId: ids.item, sceneId: ids.otherScene }),
        'A bússola @ A partida',
      ],
      [
        deleted('TagRelation', newId(), {
          tagId: ids.tag,
          relationId: ids.characterA,
          relationType: 'Character',
        }),
        '#mar → Character:Lia',
      ],
      [
        deleted('NoteRelation', newId(), {
          noteId: ids.note,
          relationId: ids.worldRule,
          relationType: 'WorldRule',
        }),
        'Pesquisa → WorldRule:A maré',
      ],
      [
        deleted('GalleryRelation', newId(), {
          galleryId: ids.gallery,
          ownerId: ids.characterB,
          ownerType: 'Character',
        }),
        'O navio → Character:Rui',
      ],
      [
        deleted('SeeAlsoRelation', newId(), {
          entityAId: ids.characterA,
          entityAType: 'Character',
          entityBId: ids.item,
          entityBType: 'Item',
        }),
        'Lia ↔ A bússola',
      ],
      [
        deleted('Favorite', newId(), { entityId: ids.chapter, entityType: 'Chapter' }),
        '★ Chapter:Capítulo 1',
      ],
      [deleted('Effect', newId(), { effectType: 'give', itemId: ids.item }), 'give: A bússola'],
      [deleted('ChoiceCheckGroup', newId(), { choiceId: ids.choice }), 'checks · Subir a bordo'],
      [
        deleted('ChoiceCheck', newId(), {
          groupId: ids.choiceGroup,
          mode: 'require',
          type: 'item',
          itemId: ids.item,
          sceneId: ids.scene,
        }),
        'Subir a bordo · require · item',
      ],
      [
        deleted('AttributeValue', newId(), {
          fieldId: ids.field,
          value: 'Capitã',
          entityId: ids.characterA,
          entityType: 'Character',
        }),
        'Patente=Capitã',
      ],
    ];

    for (const [item, expected] of cases) {
      expect(await label(item)).toBe(expected);
    }
  });

  it('falls back to a short id or a question mark when a reference cannot be resolved', async () => {
    expect(
      await label(
        deleted('CharacterRelation', newId(), {
          character1Id: MISSING_ID,
          character2Id: null,
        }),
      ),
    ).toBe(`${MISSING_ID.slice(0, 8)} ↔ ?`);

    expect(
      await label(deleted('LocationRelation', newId(), { locationAId: '', locationBId: 42 })),
    ).toBe('? → ?');

    expect(await label(deleted('TagRelation', newId(), { tagId: ids.tag }))).toBe('#mar → ?:?');

    expect(await label(deleted('NoteRelation', newId(), { noteId: ids.note, relationId: 7 }))).toBe(
      'Pesquisa → ?:?',
    );

    expect(
      await label(deleted('GalleryRelation', newId(), { galleryId: ids.galleryNoTitle })),
    ).toBe('porto.png → ?:?');

    expect(await label(deleted('SeeAlsoRelation', newId(), {}))).toBe('? ↔ ?');
    expect(await label(deleted('Favorite', newId(), { entityId: ids.item }))).toBe(
      `★ ?:${ids.item.slice(0, 8)}`,
    );
    expect(await label(deleted('AttributeValue', newId(), { value: '   ' }))).toBe('(empty)');
  });

  it('uses the trigger name and then the bare type when an effect has no item', async () => {
    expect(
      await label(deleted('Effect', newId(), { effectType: 'set', triggerName: 'ao entrar' })),
    ).toBe('set: ao entrar');
    expect(await label(deleted('Effect', newId(), {}))).toBe('effect');
  });

  it('keeps the incoming name when a check has no group, mode or type', async () => {
    expect(await label(deleted('ChoiceCheck', newId(), {}, 'nome antigo'))).toBe('nome antigo');
  });

  it('resolves a reference through a target that is itself soft deleted', async () => {
    await db.insert(characters).values({
      id: MISSING_ID,
      storyId: ids.story,
      name: 'Fantasma',
      isDeleted: true,
      deletedAt: new Date(),
    } as never);

    expect(
      await label(
        deleted('CharacterScene', newId(), { characterId: MISSING_ID, sceneId: ids.scene }),
      ),
    ).toBe('Fantasma @ A chegada');
  });

  it('returns the story titles of the tombstones, including deleted stories themselves', async () => {
    const { names, storyTitles } = await enrichDeletedDisplayNames([
      deleted('Story', ids.story, { title: 'A Queda' }, 'A Queda'),
      deleted('Chapter', ids.chapter, { name: 'Capítulo 1' }, 'Capítulo 1'),
    ]);

    expect(storyTitles.get(ids.story)).toBe('A Queda');
    // Types with no composition keep the name they already came with.
    expect(names.get(`Chapter:${ids.chapter}`)).toBe('Capítulo 1');
  });

  it('handles an empty batch without touching the database', async () => {
    const { names, storyTitles } = await enrichDeletedDisplayNames([]);

    expect(names.size).toBe(0);
    expect(storyTitles.size).toBe(0);
  });

  it('ignores references to entity types it does not know how to resolve', async () => {
    expect(
      await label(
        deleted('Favorite', newId(), { entityId: ids.characterA, entityType: 'Nonexistent' }),
      ),
    ).toBe(`★ Nonexistent:${ids.characterA.slice(0, 8)}`);
  });
});

describe('enrichOperationLogNames', () => {
  it('resolves entity name, story title and username for a log entry', async () => {
    const logId = newId();
    const result = await enrichOperationLogNames([
      {
        id: logId,
        entityType: 'Character',
        entityId: ids.characterA,
        storyId: ids.story,
        userId: ids.user,
        payload: { name: 'Lia' },
      },
    ]);

    expect(result.get(logId)).toEqual({
      entityName: 'Lia',
      storyTitle: 'A Queda',
      username: 'ana',
    });
  });

  it('merges the stored row with the payload so a delete still composes a label', async () => {
    const logId = newId();
    const result = await enrichOperationLogNames([
      {
        id: logId,
        entityType: 'CharacterScene',
        entityId: newId(),
        storyId: ids.story,
        userId: ids.user,
        // The record no longer exists; only the operation's payload carries the ends.
        payload: { characterId: ids.characterB, sceneId: ids.otherScene },
      },
    ]);

    expect(result.get(logId)?.entityName).toBe('Rui @ A partida');
  });

  it('survives a payload that is not an object and an unknown story or user', async () => {
    const logId = newId();
    const result = await enrichOperationLogNames([
      {
        id: logId,
        entityType: 'Character',
        entityId: ids.characterA,
        storyId: MISSING_ID,
        userId: MISSING_ID,
        payload: ['not', 'an', 'object'],
      },
    ]);

    expect(result.get(logId)).toEqual({
      entityName: 'Lia',
      storyTitle: null,
      username: null,
    });
  });

  it('returns nothing for an empty batch', async () => {
    expect((await enrichOperationLogNames([])).size).toBe(0);
  });
});
