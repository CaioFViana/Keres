import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { SHOWCASE_SETTINGS_SINGLETON_ID, showcaseSettings } from '../../src/db/schema';
import { ShowcaseSettingsService } from '../../src/services/ShowcaseSettingsService';
import { truncateAll } from '../helpers/database';

beforeEach(truncateAll);

describe('ShowcaseSettingsService integration', () => {
  it('creates the singleton exactly once under concurrent first reads', async () => {
    const service = new ShowcaseSettingsService();

    const [first, second] = await Promise.all([service.getOrCreate(), service.getOrCreate()]);

    expect(first.id).toBe(SHOWCASE_SETTINGS_SINGLETON_ID);
    expect(second.id).toBe(SHOWCASE_SETTINGS_SINGLETON_ID);
    expect(await db.select().from(showcaseSettings)).toHaveLength(1);
  });
});
