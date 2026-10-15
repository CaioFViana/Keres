import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db';
import { users } from '@/db/schema';
import { adminUserService } from '@/services/admin/AdminUserService';
import { ErasureLedger, erasureLedger } from '@/services/compliance/ErasureLedger';
import { applyErasureLedger } from '@/services/compliance/ErasureReplayService';
import { userService } from '@/services/accounts/UserService';
import { registerUser } from '@test/helpers/app';
import { truncateAll } from '@test/helpers/database';

const DAY = 24 * 60 * 60 * 1000;
let directory: string;
let path: string;
let ledger: ErasureLedger;

beforeEach(async () => {
  await truncateAll();
  directory = mkdtempSync(join(tmpdir(), 'keres-ledger-'));
  path = join(directory, 'nested', 'ledger.ndjson');
  ledger = new ErasureLedger(() => path);
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

async function rowOf(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

describe('ErasureLedger file', () => {
  it('appends lines, keeps only the last event of each account and skips damaged lines', () => {
    ledger.record('account_deleted', 'u1');
    ledger.record('account_deleted', 'u2');
    ledger.record('account_restored', 'u1');
    writeFileSync(path, `${readFileSync(path, 'utf8')}{"at":"not json\n{"kind":"x"}\n`, 'utf8');

    const latest = ledger.latestPerUser();

    expect(latest.map((entry) => `${entry.userId}:${entry.kind}`).sort()).toEqual([
      'u1:account_restored',
      'u2:account_deleted',
    ]);
  });

  it('holds only the id, the kind and the date', () => {
    ledger.record('account_erased', 'u1', new Date('2026-10-01T00:00:00.000Z'));

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
      at: '2026-10-01T00:00:00.000Z',
      kind: 'account_erased',
      userId: 'u1',
    });
  });

  it('drops the lines older than the retention and keeps the rest', () => {
    const now = new Date('2026-10-13T00:00:00.000Z');
    ledger.record('account_deleted', 'old', new Date(now.getTime() - 101 * DAY));
    ledger.record('account_deleted', 'new', new Date(now.getTime() - 99 * DAY));

    expect(ledger.trim(now, 100)).toBe(1);
    expect(ledger.read().map((entry) => entry.userId)).toEqual(['new']);
  });

  it('does nothing, and never throws, without a configured path', () => {
    const off = new ErasureLedger(() => undefined);

    expect(() => off.record('account_deleted', 'u1')).not.toThrow();
    expect(off.read()).toEqual([]);
    expect(off.enabled).toBe(false);
  });
});

describe('applying the ledger to a restored database', () => {
  it('deletes again an account that came back, keeping the date the person asked', async () => {
    const ana = await registerUser('ana');
    ledger.record('account_deleted', ana.userId, new Date('2026-09-20T10:00:00.000Z'));

    const outcome = await applyErasureLedger(ledger);

    expect(outcome).toEqual({ redeleted: 1, reerased: 0, restored: 0 });
    const row = await rowOf(ana.userId);
    expect(row?.isDeleted).toBe(true);
    expect(row?.deletedAt?.toISOString()).toBe('2026-09-20T10:00:00.000Z');
  });

  it('erases again the personal data of an account that was already erased', async () => {
    const ana = await registerUser('ana');
    ledger.record('account_erased', ana.userId);

    const outcome = await applyErasureLedger(ledger);

    expect(outcome.reerased).toBe(1);
    expect((await rowOf(ana.userId))?.username).toBe(`deleted:${ana.userId}`);
  });

  it('honours an administrator restoring the account after the deletion', async () => {
    const ana = await registerUser('ana');
    await db
      .update(users)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(users.id, ana.userId));
    ledger.record('account_deleted', ana.userId);
    ledger.record('account_restored', ana.userId);

    const outcome = await applyErasureLedger(ledger);

    expect(outcome.restored).toBe(1);
    expect((await rowOf(ana.userId))?.isDeleted).toBe(false);
  });

  it('changes nothing on a database that is already up to date, and skips unknown accounts', async () => {
    const ana = await registerUser('ana');
    ledger.record('account_deleted', 'no-such-account');
    ledger.record('account_restored', ana.userId);

    expect(await applyErasureLedger(ledger)).toEqual({ redeleted: 0, reerased: 0, restored: 0 });
    expect((await rowOf(ana.userId))?.isDeleted).toBe(false);
  });
});

describe('what writes the ledger', () => {
  it('self-deletion, administrator deletion and restoration, and the final erasure each leave a line', async () => {
    const record = vi.spyOn(erasureLedger, 'record').mockImplementation(() => undefined);
    try {
      const ana = await registerUser('ana');
      const bia = await registerUser('bia');

      await userService.deleteOwnAccount(ana.userId, ana.password);
      await adminUserService.softDelete(bia.userId);
      await adminUserService.restore(bia.userId);
      await userService.pruneDeletedAccounts(0, new Date(Date.now() + DAY));

      const lines = record.mock.calls.map(([kind, userId]) => `${kind}:${userId}`);
      expect(lines).toEqual([
        `account_deleted:${ana.userId}`,
        `account_deleted:${bia.userId}`,
        `account_restored:${bia.userId}`,
        `account_erased:${ana.userId}`,
      ]);
    } finally {
      record.mockRestore();
    }
  });
});
