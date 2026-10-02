import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PaymentPlugin, PaymentPluginFactory } from '@keres/shared/payments/PaymentPlugin';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * The payment plugin this server runs with, if any. One at a time, chosen at boot by `PAYMENT_PLUGIN`.
 *
 * The server must work exactly as before with none: every payments route answers "not enabled" and the
 * clients show nothing about payments. And it must keep working when the plugin is wrong - a module that
 * cannot be loaded, or does not honour the contract, is reported loudly and then ignored, because a
 * mistyped path in the payments setup must not take the whole server (and every story on it) down.
 */
let current: PaymentPlugin | null = null;

export function getPaymentPlugin(): PaymentPlugin | null {
  return current;
}

/** For boot and for the tests. */
export function setPaymentPlugin(plugin: PaymentPlugin | null): void {
  current = plugin;
}

const PLUGIN_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** Why `candidate` is not a plugin, or null when it is one. */
export function describePluginProblem(candidate: unknown): string | null {
  if (!candidate || typeof candidate !== 'object') return 'it is not an object';
  const plugin = candidate as Record<string, unknown>;
  if (typeof plugin.id !== 'string' || !PLUGIN_ID.test(plugin.id)) {
    return 'its `id` must be 1-32 lower-case letters, digits, "-" or "_"';
  }
  if (typeof plugin.displayName !== 'string' || plugin.displayName.trim() === '') {
    return 'it has no `displayName`';
  }
  for (const method of ['listMethods', 'createCheckout', 'handleWebhook']) {
    if (typeof plugin[method] !== 'function') return `it has no \`${method}\``;
  }
  return null;
}

/** A path (relative to where the server was started) or a package name, as `import()` wants it. */
function moduleTarget(specifier: string): string {
  const isPath = /^(\.{1,2}[\\/]|[\\/]|[A-Za-z]:[\\/])/.test(specifier);
  return isPath ? pathToFileURL(path.resolve(process.cwd(), specifier)).href : specifier;
}

/**
 * Loads the plugin named by `PAYMENT_PLUGIN` and makes it the current one. Never throws: whatever goes wrong
 * is logged and the server carries on without payments. Returns the plugin, or null.
 */
export async function loadPaymentPlugin(
  specifier: string | undefined = env.PAYMENT_PLUGIN,
): Promise<PaymentPlugin | null> {
  setPaymentPlugin(null);
  if (!specifier) return null;
  try {
    const loaded = (await import(moduleTarget(specifier))) as { default?: unknown };
    const exported = loaded.default ?? loaded;
    const plugin =
      typeof exported === 'function'
        ? await (exported as PaymentPluginFactory)({ env: process.env, log: logger })
        : exported;
    const problem = describePluginProblem(plugin);
    if (problem) {
      logger.error(`Payment plugin "${specifier}" ignored: ${problem}.`);
      return null;
    }
    setPaymentPlugin(plugin as PaymentPlugin);
    logger.info(`Payment plugin "${(plugin as PaymentPlugin).id}" loaded.`);
    return current;
  } catch (error) {
    logger.error(`Payment plugin "${specifier}" could not be loaded; payments are off.`, error);
    return null;
  }
}
