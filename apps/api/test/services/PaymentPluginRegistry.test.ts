import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  describePluginProblem,
  getPaymentPlugin,
  loadPaymentPlugin,
  setPaymentPlugin,
} from '../../src/services/payments/PaymentPluginRegistry';
import { logger } from '../../src/utils/logger';

const GOOD = `
const plugin = (extra = {}) => ({
  id: 'acme',
  displayName: 'Acme Pay',
  listMethods: () => [],
  createCheckout: async () => ({ providerReference: 'x', action: { kind: 'none' } }),
  handleWebhook: async () => [],
  ...extra,
});
`;

let directory: string;
const write = (name: string, source: string) => {
  const file = join(directory, name);
  writeFileSync(file, source);
  return file;
};

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'keres-plugin-'));
  vi.spyOn(logger, 'info').mockImplementation(() => {});
  vi.spyOn(logger, 'error').mockImplementation(() => {});
  setPaymentPlugin(null);
});

afterEach(() => {
  setPaymentPlugin(null);
  vi.restoreAllMocks();
  rmSync(directory, { recursive: true, force: true });
});

describe('describePluginProblem', () => {
  const base = {
    id: 'acme',
    displayName: 'Acme',
    listMethods: () => [],
    createCheckout: async () => ({}),
    handleWebhook: async () => [],
  };

  it('accepts what meets the contract', () => {
    expect(describePluginProblem(base)).toBeNull();
  });

  it.each([
    ['nothing', undefined, /not an object/],
    ['a string', 'acme', /not an object/],
    ['an id with capitals', { ...base, id: 'Acme' }, /`id`/],
    ['an empty id', { ...base, id: '' }, /`id`/],
    ['an id that is too long', { ...base, id: 'a'.repeat(33) }, /`id`/],
    ['no display name', { ...base, displayName: '  ' }, /displayName/],
    ['no listMethods', { ...base, listMethods: undefined }, /listMethods/],
    ['no createCheckout', { ...base, createCheckout: 'x' }, /createCheckout/],
    ['no handleWebhook', { ...base, handleWebhook: undefined }, /handleWebhook/],
  ])('refuses %s', (_label, candidate, reason) => {
    expect(describePluginProblem(candidate)).toMatch(reason);
  });

  it('does not ask for the optional parts', () => {
    expect(describePluginProblem({ ...base, cancelSubscription: undefined })).toBeNull();
  });
});

describe('loadPaymentPlugin', () => {
  it('does nothing, and says nothing, when no plugin is configured', async () => {
    expect(await loadPaymentPlugin(undefined)).toBeNull();
    expect(getPaymentPlugin()).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('loads a module whose default export is a factory, handing it the environment and a logger', async () => {
    const file = write(
      'factory.mjs',
      `${GOOD}
export default (context) => plugin({ displayName: 'Acme ' + (context.env.PATH ? 'with env' : 'no env'), seen: typeof context.log.info });`,
    );

    const plugin = await loadPaymentPlugin(file);

    expect(plugin).toMatchObject({ id: 'acme', seen: 'function' });
    expect(plugin?.displayName).toBe('Acme with env');
    expect(getPaymentPlugin()).toBe(plugin);
  });

  it('loads a module whose default export is the plugin itself', async () => {
    const file = write('object.mjs', `${GOOD}\nexport default plugin();`);

    expect((await loadPaymentPlugin(file))?.id).toBe('acme');
  });

  it('waits for an asynchronous factory', async () => {
    const file = write('async.mjs', `${GOOD}\nexport default async () => plugin({ id: 'later' });`);

    expect((await loadPaymentPlugin(file))?.id).toBe('later');
  });

  it('resolves a relative path from where the server was started', async () => {
    write('relative.mjs', `${GOOD}\nexport default plugin();`);
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(directory);

    expect((await loadPaymentPlugin('./relative.mjs'))?.id).toBe('acme');
    cwd.mockRestore();
  });

  it('replaces the plugin that was loaded before, and removes it when nothing is configured', async () => {
    await loadPaymentPlugin(write('one.mjs', `${GOOD}\nexport default plugin({ id: 'one' });`));
    await loadPaymentPlugin(write('two.mjs', `${GOOD}\nexport default plugin({ id: 'two' });`));
    expect(getPaymentPlugin()?.id).toBe('two');

    await loadPaymentPlugin(undefined);

    expect(getPaymentPlugin()).toBeNull();
  });

  it.each([
    ['a module that does not exist', () => join(directory, 'missing.mjs')],
    ['a package that does not exist', () => 'keres-payment-plugin-that-is-not-installed'],
    ['a module that throws when loaded', () => write('boom.mjs', 'throw new Error("boom");')],
    [
      'a factory that throws',
      () => write('factory-boom.mjs', 'export default () => { throw new Error("no keys"); };'),
    ],
    [
      'a module that breaks the contract',
      () => write('bad.mjs', `${GOOD}\nexport default plugin({ handleWebhook: undefined });`),
    ],
    ['a module that exports something else', () => write('number.mjs', 'export default 42;')],
  ])('carries on without payments, loudly, for %s', async (_label, target) => {
    expect(await loadPaymentPlugin(target())).toBeNull();

    expect(getPaymentPlugin()).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
