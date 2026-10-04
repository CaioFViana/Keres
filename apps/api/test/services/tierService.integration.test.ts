import { TierCreateInputSchema } from '@keres/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { tiers } from '../../src/db/schema';
import {
  TierNotFoundError,
  TierPlayProductAlreadyUsedError,
  TierService,
} from '../../src/services/TierService';
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

  const create = (over: Record<string, unknown>) =>
    service.create(TierCreateInputSchema.parse({ name: 'Tier', ...over }));

  it('refuses a store product another tier already sells, on any period', async () => {
    await create({ name: 'Pro', playMonthlyProductId: 'pro_monthly' });

    await expect(create({ name: 'Plus', playMonthlyProductId: 'pro_monthly' })).rejects.toThrow(
      TierPlayProductAlreadyUsedError,
    );
    await expect(create({ name: 'Plus', playYearlyProductId: 'pro_monthly' })).rejects.toThrow(
      TierPlayProductAlreadyUsedError,
    );
  });

  it('refuses an update that takes a store product another tier sells', async () => {
    const pro = await create({ name: 'Pro', playYearlyProductId: 'pro_yearly' });
    const plus = await create({ name: 'Plus' });

    await expect(service.update(plus.id, { playMonthlyProductId: 'pro_yearly' })).rejects.toThrow(
      TierPlayProductAlreadyUsedError,
    );
    // Restating its own product is not taking anything.
    await service.update(pro.id, { playYearlyProductId: 'pro_yearly' });
    expect(await service.getById(pro.id)).toMatchObject({ playYearlyProductId: 'pro_yearly' });
  });

  it('lets a new tier reuse a store product of a deleted tier', async () => {
    const pro = await create({ name: 'Pro', playMonthlyProductId: 'pro_monthly' });
    await service.softDelete(pro.id);

    const plus = await create({ name: 'Plus', playMonthlyProductId: 'pro_monthly' });
    expect(plus.playMonthlyProductId).toBe('pro_monthly');
  });

  it('lets an update restate the current name or skip the name', async () => {
    const id = await seedTier('Sonhador');

    await service.update(id, { name: 'Sonhador', maxStories: 3 });
    expect(await service.getById(id)).toMatchObject({ name: 'Sonhador', maxStories: 3 });

    await service.update(id, { maxEntitiesTotal: 100 });
    expect(await service.getById(id)).toMatchObject({ name: 'Sonhador', maxEntitiesTotal: 100 });
  });
});
