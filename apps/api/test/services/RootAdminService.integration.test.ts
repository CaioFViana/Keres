import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db';
import { users } from '../../src/db/schema';
import { truncateAll } from '../helpers/database';

const config = vi.hoisted(() => ({ env: { ROOT_ADMIN_USERNAME: undefined as string | undefined, ROOT_ADMIN_PASSWORD: undefined as string | undefined } }));
const logger = vi.hoisted(() => ({ info: vi.fn() }));

vi.mock('../../src/config/env', () => config);
vi.mock('../../src/utils/logger', () => ({ logger }));

beforeEach(async () => {
  await truncateAll();
  config.env.ROOT_ADMIN_USERNAME = undefined;
  config.env.ROOT_ADMIN_PASSWORD = undefined;
  logger.info.mockClear();
});

describe('RootAdminService integration', () => {
  it('does nothing when the root admin credentials are not configured', async () => {
    const { reconcileRootAdmin } = await import('../../src/services/RootAdminService');
    await reconcileRootAdmin();

    expect(await db.select().from(users)).toEqual([]);
  });

  it('creates the configured root administrator and reconciles its elevated access on subsequent boots', async () => {
    config.env.ROOT_ADMIN_USERNAME = 'root';
    config.env.ROOT_ADMIN_PASSWORD = 'secure-root-password';
    const { reconcileRootAdmin } = await import('../../src/services/RootAdminService');
    await reconcileRootAdmin();
    const created = await db.query.users.findFirst({ where: (fields, { eq }) => eq(fields.username, 'root') });
    expect(created).toMatchObject({ username: 'root', tag: 'root', isAdmin: true });
    expect(await bcrypt.compare('secure-root-password', created!.password)).toBe(true);

    await db.update(users).set({ isAdmin: false, password: 'outdated' }).where(eq(users.id, created!.id));
    await reconcileRootAdmin();
    const reconciled = await db.query.users.findFirst({ where: (fields, { eq }) => eq(fields.id, created!.id) });
    expect(reconciled?.isAdmin).toBe(true);
    expect(await bcrypt.compare('secure-root-password', reconciled!.password)).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Root admin 'root' created."));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Root admin 'root' reconciled"));
  });
});
