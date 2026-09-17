import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { tiers } from '../../src/db/schema';
import { TierNotFoundError, TierService } from '../../src/services/TierService';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let service: TierService;

const seedTier = async (name: string) => {
  const id = newId();
  await db.insert(tiers).values({
    id,
    name,
    isDefault: false,
    maxStories: null,
    maxEntitiesPerStory: null,
    maxEntitiesTotal: null,
    maxStorageBytesPerStory: null,
    maxStorageBytesTotal: null,
  } as never);
  return id;
};

beforeEach(async () => {
  await truncateAll();
  service = new TierService();
});

describe('TierService gaps', () => {
  it('reports a missing tier on update and on delete', async () => {
    await expect(service.update(newId(), { maxStories: 3 })).rejects.toThrow(TierNotFoundError);
    await expect(service.softDelete(newId())).rejects.toThrow(TierNotFoundError);
  });

  it('lets an update restate the current name or skip the name', async () => {
    const id = await seedTier('Sonhador');

    await service.update(id, { name: 'Sonhador', maxStories: 3 });
    expect(await service.getById(id)).toMatchObject({ name: 'Sonhador', maxStories: 3 });

    await service.update(id, { maxEntitiesTotal: 100 });
    expect(await service.getById(id)).toMatchObject({ name: 'Sonhador', maxEntitiesTotal: 100 });
  });
});
