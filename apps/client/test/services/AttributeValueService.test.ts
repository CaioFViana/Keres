/**
 * @jest-environment node
 */
import { AttributeType } from '@keres/shared';
import { asc, eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createAttributeValueService } from '../../src/services/storymanagement/AttributeValueService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const FIELD_ID = '01ARZ3NDEKTSV4RRFFQ69G5FIE';
const CHARACTER_ID = '01ARZ3NDEKTSV4RRFFQ69G5CHA';
const NOW = new Date('2026-08-10T12:00:00.000Z');
const base = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  await database.db
    .insert(schema.stories)
    .values({ id: STORY_ID, userId: 'local', title: 'A Queda', type: 'linear', ...base });
  await database.db.insert(schema.storySchemaFields).values({
    id: FIELD_ID,
    storyId: STORY_ID,
    entityType: 'Character',
    name: 'Origem',
    key: 'origem',
    type: AttributeType.TEXT,
    isRequired: false,
    order: 0,
    ...base,
  });
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('saveValuesForEntity after the field was cleared', () => {
  it('revives the removed value instead of colliding with it', async () => {
    const service = createAttributeValueService(database.db);
    await service.saveValuesForEntity('local', STORY_ID, 'Character', CHARACTER_ID, {
      [FIELD_ID]: 'Submundo',
    });
    await service.deleteValuesForField('local', STORY_ID, FIELD_ID);

    // (entityId, fieldId) is unique across deleted rows too: a second insert used to throw here.
    await service.saveValuesForEntity('local', STORY_ID, 'Character', CHARACTER_ID, {
      [FIELD_ID]: 'Olimpo',
    });

    const rows = await database.db.query.attributeValues.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      value: 'Olimpo',
      isDeleted: false,
      deletedAt: null,
      version: 3,
    });
    const operations = await database.db.query.operationLogs.findMany({
      where: eq(schema.operationLogs.entityId, rows[0]!.id),
      orderBy: [asc(schema.operationLogs.operationVersion)],
    });
    expect(operations.map((op) => op.operationType)).toEqual(['create', 'delete', 'update']);
    // `isDeleted: false` on a deleted row is what the server applies as a restore.
    expect(JSON.parse(operations[2]!.payload)).toEqual({
      value: 'Olimpo',
      isDeleted: false,
      version: 3,
    });
  });
});
