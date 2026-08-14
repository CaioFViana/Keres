/**
 * @jest-environment node
 */
import { OperationLogEntityType } from '@keres/shared';
import type { TFunction } from 'i18next';
import * as schema from '../../src/db/schema';
import { EntityService } from '../../src/services/EntityService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');

/** Devolve a própria chave, para o teste ler o rótulo sem depender do arquivo de tradução. */
const t = ((key: string) => key) as unknown as TFunction;

let database: TestDatabase;

const base = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };

async function seedStory(overrides: Partial<typeof schema.stories.$inferInsert> = {}) {
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: 'local-user',
    title: 'A Queda',
    type: 'linear',
    ...base,
    ...overrides,
  });
}

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(() => {
  database.close();
});

/**
 * `getEntityName` é o que dá nome legível a cada linha da tela de log de operações. Sem ele o
 * histórico vira uma lista de ULIDs, então o que importa é justamente o caso em que a entidade
 * não é mais encontrável: precisa degradar para o tipo traduzido, nunca quebrar a tela.
 */
describe('getEntityName', () => {
  it('names a story by its title', async () => {
    await seedStory();

    const name = await EntityService.getEntityName(
      database.db,
      OperationLogEntityType.Story,
      STORY_ID,
      STORY_ID,
      t,
    );

    expect(name).toBe('story - A Queda');
  });

  it('names a character by its name', async () => {
    await seedStory();
    await database.db
      .insert(schema.characters)
      .values({ id: 'char-1', storyId: STORY_ID, name: 'Keres', ...base });

    const name = await EntityService.getEntityName(
      database.db,
      OperationLogEntityType.Character,
      'char-1',
      STORY_ID,
      t,
    );

    expect(name).toBe('character - Keres');
  });

  it.each([
    ['note', OperationLogEntityType.Note, schema.notes, { title: 'Ideia' }, 'note - Ideia'],
    [
      'location',
      OperationLogEntityType.Location,
      schema.locations,
      { name: 'Ávalon' },
      'location - Ávalon',
    ],
    [
      'world rule',
      OperationLogEntityType.WorldRule,
      schema.worldRules,
      { title: 'Magia' },
      'world_rule - Magia',
    ],
    ['tag', OperationLogEntityType.Tag, schema.tags, { name: 'Vilões' }, 'tag - Vilões'],
  ])('names a %s', async (_label, entityType, table, columns, expected) => {
    await seedStory();
    await database.db
      .insert(table as never)
      .values({ id: 'e-1', storyId: STORY_ID, ...columns, ...base } as never);

    const name = await EntityService.getEntityName(database.db, entityType, 'e-1', STORY_ID, t);

    expect(name).toBe(expected);
  });

  it('falls back to the translated type when the entity is gone', async () => {
    await seedStory();

    const name = await EntityService.getEntityName(
      database.db,
      OperationLogEntityType.Character,
      'sumiu',
      STORY_ID,
      t,
    );

    expect(name).toBe('character');
  });

  /**
   * Um log de exclusão aponta justamente para uma linha marcada como excluída; a consulta
   * filtra `isDeleted`, então esse caso cai no rótulo genérico em vez de mostrar o nome.
   */
  it('falls back to the translated type for a deleted entity', async () => {
    await seedStory();
    await database.db.insert(schema.characters).values({
      id: 'char-1',
      storyId: STORY_ID,
      name: 'Keres',
      ...base,
      isDeleted: true,
    });

    const name = await EntityService.getEntityName(
      database.db,
      OperationLogEntityType.Character,
      'char-1',
      STORY_ID,
      t,
    );

    expect(name).toBe('character');
  });

  it('does not confuse two entities that share an id across tables', async () => {
    await seedStory();
    await database.db
      .insert(schema.characters)
      .values({ id: 'mesmo-id', storyId: STORY_ID, name: 'Keres', ...base });
    await database.db
      .insert(schema.tags)
      .values({ id: 'mesmo-id', storyId: STORY_ID, name: 'Vilões', ...base });

    expect(
      await EntityService.getEntityName(
        database.db,
        OperationLogEntityType.Character,
        'mesmo-id',
        STORY_ID,
        t,
      ),
    ).toBe('character - Keres');
    expect(
      await EntityService.getEntityName(
        database.db,
        OperationLogEntityType.Tag,
        'mesmo-id',
        STORY_ID,
        t,
      ),
    ).toBe('tag - Vilões');
  });
});

describe('getEntityIdentifier', () => {
  it.each([
    ['Character', 'char-1'],
    ['character', 'char-1'],
    ['CHARACTER', 'char-1'],
  ])('resolves the entity type %s regardless of case', async (entityTypeString) => {
    await seedStory();
    await database.db
      .insert(schema.characters)
      .values({ id: 'char-1', storyId: STORY_ID, name: 'Keres', ...base });

    expect(
      await EntityService.getEntityIdentifier(database.db, entityTypeString, 'char-1', STORY_ID, t),
    ).toBe('Keres');
  });

  it('returns the bare name, without the type prefix', async () => {
    await seedStory();

    expect(
      await EntityService.getEntityIdentifier(database.db, 'Story', STORY_ID, STORY_ID, t),
    ).toBe('A Queda');
  });

  it('returns nothing for an entity that is not there', async () => {
    await seedStory();

    expect(
      await EntityService.getEntityIdentifier(database.db, 'Character', 'sumiu', STORY_ID, t),
    ).toBeUndefined();
  });

  it('rejects an entity type it does not know, instead of guessing', async () => {
    await expect(
      EntityService.getEntityIdentifier(database.db, 'Dragao', 'e-1', STORY_ID, t),
    ).rejects.toThrow(/Invalid entityTypeString/);
  });
});
