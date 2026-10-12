import { randomBytes } from 'node:crypto';
import { ConfigError, loadConfig } from '../config';
import { hashPassword } from '../crypto/password';
import type { Stores } from '../store/stores';
import { openStores } from '../store/stores';

/**
 * `bun run reviewer:add <name>` creates a reviewer account. The password is `REVIEWER_PASSWORD` when set, otherwise a
 * random one printed once here: it is not stored anywhere in plain text, so it cannot be shown again.
 *
 * Runs against the same configuration as the service (`DATA_DIR` must be the one the service uses), so it reads the
 * whole environment and refuses to run on a configuration the service would refuse.
 */

export const MIN_REVIEWER_PASSWORD_LENGTH = 12;
const GENERATED_PASSWORD_BYTES = 18;
const NAME_MAX_LENGTH = 64;

export class ReviewerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewerError';
  }
}

/** Adds a reviewer with a hashed password. Throws `ReviewerError` when the name is invalid or taken. */
export async function addReviewer(
  stores: Pick<Stores, 'reviewers'>,
  name: string,
  password: string,
  now: number,
): Promise<string> {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > NAME_MAX_LENGTH) {
    throw new ReviewerError(`The name must be 1-${NAME_MAX_LENGTH} characters.`);
  }
  if (password.length < MIN_REVIEWER_PASSWORD_LENGTH) {
    throw new ReviewerError(
      `The password must be at least ${MIN_REVIEWER_PASSWORD_LENGTH} characters.`,
    );
  }
  if (stores.reviewers.byName(trimmed))
    throw new ReviewerError(`A reviewer named "${trimmed}" exists.`);
  return stores.reviewers.add(trimmed, await hashPassword(password), now);
}

/** The command: returns the exit code. The generated password, when there is one, is the only output that is secret. */
export async function runAddReviewer(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<number> {
  const name = argv[0]?.trim() ?? '';
  if (name === '') {
    console.error('Usage: bun run reviewer:add <name>   (REVIEWER_PASSWORD optional)');
    return 2;
  }
  let stores: Stores;
  try {
    stores = openStores(loadConfig(env));
  } catch (error) {
    if (error instanceof ConfigError) {
      for (const problem of error.problems) console.error(`ERROR: ${problem}`);
    } else {
      console.error(error instanceof Error ? error.message : 'The configuration does not load.');
    }
    return 1;
  }
  const generated = !env['REVIEWER_PASSWORD'];
  const password =
    env['REVIEWER_PASSWORD'] || randomBytes(GENERATED_PASSWORD_BYTES).toString('base64url');
  try {
    const id = await addReviewer(stores, name, password, Date.now());
    console.log(`Reviewer "${name}" created (id ${id}).`);
    if (generated) console.log(`Generated password, shown once: ${password}`);
    return 0;
  } catch (error) {
    console.error(
      error instanceof ReviewerError ? error.message : 'The reviewer could not be created.',
    );
    return 1;
  } finally {
    stores.close();
  }
}

if (import.meta.main) {
  process.exitCode = await runAddReviewer(process.argv.slice(2), process.env);
}
