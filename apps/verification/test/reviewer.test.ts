import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from '../src/crypto/password';
import {
  addReviewer,
  MIN_REVIEWER_PASSWORD_LENGTH,
  ReviewerError,
  runAddReviewer,
} from '../src/cli/addReviewer';
import { openStores, type Stores } from '../src/store/stores';
import { testEnv } from './helpers/harness';

const PASSWORD = 'correct horse battery staple';

describe('reviewer passwords', () => {
  it('stores a scrypt string that carries its own parameters and verifies only the right password', async () => {
    const stored = await hashPassword(PASSWORD);
    expect(stored.startsWith('scrypt$32768$8$1$')).toBe(true);
    expect(stored).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, stored)).toBe(true);
    expect(await verifyPassword(`${PASSWORD}!`, stored)).toBe(false);
  });

  it('gives a different salt, and so a different string, for the same password', async () => {
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });

  it('refuses a stored value that is not of the expected shape', async () => {
    expect(await verifyPassword(PASSWORD, 'plain-text-password')).toBe(false);
    expect(await verifyPassword(PASSWORD, 'argon2$1$2$3$aaaa$bbbb')).toBe(false);
    expect(await verifyPassword(PASSWORD, 'scrypt$x$8$1$aaaa$bbbb')).toBe(false);
  });
});

describe('adding a reviewer', () => {
  let root: string;
  let stores: Stores;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'keres-verification-reviewer-'));
    stores = openStores({ dataDir: join(root, 'data'), keyDir: join(root, 'keys') });
  });
  afterEach(() => {
    stores.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('creates the reviewer with a hashed password, and refuses a short password', async () => {
    const id = await addReviewer(stores, '  Ana  ', PASSWORD, 1);
    const row = stores.reviewers.byName('Ana');
    expect(row?.id).toBe(id);
    expect(row?.passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, row?.passwordHash ?? '')).toBe(true);

    const short = 'x'.repeat(MIN_REVIEWER_PASSWORD_LENGTH - 1);
    await expect(addReviewer(stores, 'Bea', short, 1)).rejects.toThrow(ReviewerError);
    expect(stores.reviewers.byName('Bea')).toBeUndefined();
  });

  it('refuses a name taken by another reviewer, and an empty or overlong name', async () => {
    await addReviewer(stores, 'Ana', PASSWORD, 1);
    await expect(addReviewer(stores, 'Ana', PASSWORD, 2)).rejects.toThrow(
      'A reviewer named "Ana" exists.',
    );
    await expect(addReviewer(stores, '   ', PASSWORD, 2)).rejects.toThrow(ReviewerError);
    await expect(addReviewer(stores, 'n'.repeat(65), PASSWORD, 2)).rejects.toThrow(ReviewerError);
  });
});

describe('the reviewer:add command', () => {
  let root: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'keres-verification-cli-'));
    env = testEnv(join(root, 'data'), join(root, 'keys'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('asks for a name, and refuses to run on a configuration the service would refuse', async () => {
    expect(await runAddReviewer([], env)).toBe(2);
    expect(await runAddReviewer(['Ana'], { ...env, COMMITMENT_KEY: 'short' })).toBe(1);
    expect(await runAddReviewer(['Ana'], {})).toBe(1);
  });

  it('creates the reviewer with REVIEWER_PASSWORD, and prints no password', async () => {
    const logged: string[] = [];
    vi.mocked(console.log).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
    expect(await runAddReviewer(['Ana'], { ...env, REVIEWER_PASSWORD: PASSWORD })).toBe(0);
    expect(logged.join('\n')).not.toContain('Generated password');
    expect(logged.join('\n')).not.toContain(PASSWORD);

    const stores = openStores({ dataDir: join(root, 'data'), keyDir: join(root, 'keys') });
    try {
      expect(
        await verifyPassword(PASSWORD, stores.reviewers.byName('Ana')?.passwordHash ?? ''),
      ).toBe(true);
    } finally {
      stores.close();
    }
  });

  it('generates a password when none is given, prints it once, and stores only its hash', async () => {
    const logged: string[] = [];
    vi.mocked(console.log).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
    expect(await runAddReviewer(['Bea'], env)).toBe(0);
    const shown = logged.find((line) => line.startsWith('Generated password, shown once: '));
    expect(shown).toBeDefined();
    const generated = (shown ?? '').replace('Generated password, shown once: ', '');
    expect(generated.length).toBeGreaterThanOrEqual(MIN_REVIEWER_PASSWORD_LENGTH);

    const stores = openStores({ dataDir: join(root, 'data'), keyDir: join(root, 'keys') });
    try {
      const row = stores.reviewers.byName('Bea');
      expect(row?.passwordHash).not.toContain(generated);
      expect(await verifyPassword(generated, row?.passwordHash ?? '')).toBe(true);
    } finally {
      stores.close();
    }
  });
});
