/**
 * @jest-environment node
 */
import { asc } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createStatRelationService } from '../../src/services/storymanagement/StatRelationService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * O que o cliente registra no log de operações ao mexer em valores de status.
 *
 * O push manda a versão *base* derivada do payload (`payload.version - 1`, ver
 * `SyncEngineService.deriveBaseVersion`), então um payload sem `version` numérico vira um
 * update/delete sem base - e o servidor recusa isso como `validation`, que é o conflito
 * genérico "os dados não são válidos" que aparece na tela.
 */
const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const USER_ID = 'local-user';
const CHARACTER_ID = 'char-1';
const STAT_ID = 'stat-1';
const NOW = new Date('2026-08-10T12:00:00.000Z');
const base = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };

let database: TestDatabase;

const service = () => createStatRelationService(database.db);

async function operations() {
  return database.db.query.operationLogs.findMany({
    orderBy: ({ operationVersion }) => [asc(operationVersion)],
  });
}

/** A base que o push mandaria para esta operação. */
function baseVersionOf(payload: string): number | undefined {
  const version = JSON.parse(payload)?.version;
  return typeof version === 'number' && version >= 1 ? version - 1 : undefined;
}

beforeEach(async () => {
  database = await createTestDatabase();
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: USER_ID,
    title: 'A Queda',
    type: 'linear',
    statSystem: true,
    ...base,
  });
  await database.db
    .insert(schema.characters)
    .values({ id: CHARACTER_ID, storyId: STORY_ID, name: 'Ilda', ...base });
  await database.db.insert(schema.stats).values({
    id: STAT_ID,
    storyId: STORY_ID,
    name: 'Dexterity',
    isPrimary: true,
    order: 0,
    ...base,
  });
});

afterEach(() => {
  database.close();
});

const set = (value: number, modeId: string | null = null) =>
  service().setValue(USER_ID, {
    storyId: STORY_ID,
    characterId: CHARACTER_ID,
    modeId,
    statId: STAT_ID,
    value,
  });

const clear = (modeId: string | null = null) =>
  service().clearValue(USER_ID, { characterId: CHARACTER_ID, modeId, statId: STAT_ID });

describe('the operation stream of stat values', () => {
  it('logs a create with the version the server can derive a base from', async () => {
    await set(5);

    const [operation] = await operations();
    expect(operation).toMatchObject({ operationType: 'create', entityType: 'StatRelation' });
    expect(baseVersionOf(operation!.payload)).toBe(0);
  });

  it('logs an update whose base version matches the row the server has', async () => {
    await set(5);
    await set(7);

    const [, update] = await operations();
    expect(update).toMatchObject({ operationType: 'update' });
    expect(baseVersionOf(update!.payload)).toBe(1);
  });

  it('logs a delete whose base version matches the row the server has', async () => {
    await set(5);
    await clear();

    const [, remove] = await operations();
    expect(remove).toMatchObject({ operationType: 'delete' });
    expect(baseVersionOf(remove!.payload)).toBe(1);
  });

  it('keeps only one live row through create, clear and create again', async () => {
    await set(5);
    await clear();
    await set(7);

    const rows = await database.db.query.statRelations.findMany();
    expect(rows.filter((row) => !row.isDeleted)).toHaveLength(1);
    expect(rows.filter((row) => !row.isDeleted)[0]!.value).toBe(7);
    expect((await operations()).map((row) => row.operationType)).toEqual([
      'create',
      'delete',
      'create',
    ]);
  });

  it('never writes two live rows for the same character, mode and stat', async () => {
    // Duas gravações disparadas em paralelo é o que um `onBlur` repetido produz na tela.
    await Promise.all([set(5), set(7)]);

    const live = (await database.db.query.statRelations.findMany()).filter((row) => !row.isDeleted);
    expect(live).toHaveLength(1);
  });

  it('reuses the row of a mode instead of stacking one per edit', async () => {
    await database.db.insert(schema.modes).values({
      id: 'mode-1',
      storyId: STORY_ID,
      characterId: CHARACTER_ID,
      name: 'Na tempestade',
      order: 0,
      ...base,
    });

    await set(5, 'mode-1');
    await set(9, 'mode-1');

    const live = (await database.db.query.statRelations.findMany()).filter((row) => !row.isDeleted);
    expect(live).toHaveLength(1);
    expect(live[0]!.value).toBe(9);
  });
});

/**
 * Aparelhos que já rodaram a versão com a corrida ficaram com duas linhas vivas para o mesmo
 * campo, e o servidor recusa a segunda em toda sincronização. A primeira escrita depois da
 * correção precisa desfazer isso sozinha, senão o conflito volta para sempre.
 */
describe('repairing duplicates that already exist on the device', () => {
  // ULID é ordenável por tempo de criação, e é dessa ordem que o serviço decide quem fica -
  // ids inventados fora dessa ordem fariam o teste passar pelo motivo errado.
  const OLDER = '01AAAAAAAAAAAAAAAAAAAAAAAA';
  const NEWER = '01BBBBBBBBBBBBBBBBBBBBBBBB';

  async function seedDuplicatePair() {
    for (const [id, value] of [
      [OLDER, 5],
      [NEWER, 7],
    ] as const) {
      await database.db.insert(schema.statRelations).values({
        id,
        storyId: STORY_ID,
        characterId: CHARACTER_ID,
        modeId: null,
        statId: STAT_ID,
        value,
        ...base,
      });
    }
  }

  it('collapses the extra row on the next write, keeping the oldest', async () => {
    await seedDuplicatePair();

    await set(9);

    const rows = await database.db.query.statRelations.findMany();
    const live = rows.filter((row) => !row.isDeleted);
    expect(live).toHaveLength(1);
    expect(live[0]!.id).toBe(OLDER);
    expect(live[0]!.value).toBe(9);
  });

  it('logs the deletion of the extra row, so the server converges too', async () => {
    await seedDuplicatePair();

    await set(9);

    const logged = (await operations()).filter((row) => row.operationType === 'delete');
    expect(logged).toHaveLength(1);
    expect(logged[0]!.entityId).toBe(NEWER);
    expect(baseVersionOf(logged[0]!.payload)).toBe(1);
  });

  it('clears every live row at once, so a duplicate cannot resurrect the value', async () => {
    await seedDuplicatePair();

    await clear();

    const rows = await database.db.query.statRelations.findMany();
    expect(rows.filter((row) => !row.isDeleted)).toEqual([]);
    expect((await operations()).filter((row) => row.operationType === 'delete')).toHaveLength(2);
  });
});
