/**
 * @jest-environment node
 */
import { AttributeType } from '@keres/shared';
import { characters, storySchemaFields, attributeValues } from '../../src/db/schema';
import { buildCustomAttributeSearchCondition } from '../../src/utils/attributeSearchPredicate';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = 'story-1';
const NOW = new Date('2026-08-14T12:00:00.000Z');
const base = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };

let database: TestDatabase;

async function seedCharacter(id: string, name = id) {
  await database.db.insert(characters).values({ id, storyId: STORY_ID, name, ...base });
}

async function seedField(id: string, type: AttributeType) {
  await database.db.insert(storySchemaFields).values({
    id,
    storyId: STORY_ID,
    entityType: 'Character',
    name: id,
    key: id,
    description: null,
    type,
    targetEntityType: null,
    isRequired: false,
    defaultValue: null,
    order: 0,
    ...base,
  });
}

async function seedValue(
  id: string,
  entityId: string,
  fieldId: string,
  value: string,
  isDeleted = false,
) {
  await database.db.insert(attributeValues).values({
    id,
    storyId: STORY_ID,
    entityType: 'Character',
    entityId,
    fieldId,
    value,
    ...base,
    isDeleted,
    deletedAt: isDeleted ? NOW : null,
  });
}

async function matchingCharacterIds(fieldId: string, value: unknown) {
  const condition = await buildCustomAttributeSearchCondition(
    database.db,
    characters.id,
    `custom:${fieldId}`,
    value,
  );
  if (!condition) return null;
  return database.db.select({ id: characters.id }).from(characters).where(condition).all();
}

beforeEach(async () => {
  database = await createTestDatabase();
  await seedCharacter('char-1', 'Ada');
  await seedCharacter('char-2', 'Grace');
  await seedCharacter('char-3', 'Linus');
});

afterEach(() => database.close());

describe('buildCustomAttributeSearchCondition', () => {
  it('ignores native criteria and deleted or unknown custom fields', async () => {
    expect(
      await buildCustomAttributeSearchCondition(database.db, characters.id, 'name', 'Ada'),
    ).toBeNull();
    expect(
      await buildCustomAttributeSearchCondition(database.db, characters.id, 'custom:gone', 'Ada'),
    ).toBeNull();
  });

  it('matches text attributes by a case-insensitive substring and excludes deleted values', async () => {
    await seedField('epithet', AttributeType.TEXT);
    await seedValue('value-1', 'char-1', 'epithet', 'Analytical Engine');
    await seedValue('value-2', 'char-2', 'epithet', 'Admiral', true);

    expect(await matchingCharacterIds('epithet', 'ANALYTICAL')).toEqual([{ id: 'char-1' }]);
  });

  it('normalizes finite numbers before comparing their serialized values', async () => {
    await seedField('rank', AttributeType.NUMBER);
    await seedValue('value-1', 'char-1', 'rank', '7');
    await seedValue('value-2', 'char-2', 'rank', '7.5');

    expect(await matchingCharacterIds('rank', '07')).toEqual([{ id: 'char-1' }]);
    expect(await matchingCharacterIds('rank', '7.5')).toEqual([{ id: 'char-2' }]);
    expect(await matchingCharacterIds('rank', 'not-a-number')).toBeNull();
  });

  it('uses the stored boolean encoding for both boolean and string criteria', async () => {
    await seedField('isMage', AttributeType.BOOLEAN);
    await seedValue('value-1', 'char-1', 'isMage', 'true');
    await seedValue('value-2', 'char-2', 'isMage', 'false');

    expect(await matchingCharacterIds('isMage', true)).toEqual([{ id: 'char-1' }]);
    expect(await matchingCharacterIds('isMage', 'false')).toEqual([{ id: 'char-2' }]);
  });

  it('matches entity references exactly instead of treating their ids as free text', async () => {
    await seedField('mentor', AttributeType.ENTITY);
    await seedValue('value-1', 'char-1', 'mentor', 'char-2');
    await seedValue('value-2', 'char-3', 'mentor', 'char-20');

    expect(await matchingCharacterIds('mentor', 'char-2')).toEqual([{ id: 'char-1' }]);
  });
});
