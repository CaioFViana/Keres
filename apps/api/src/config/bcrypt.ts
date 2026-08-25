import bcrypt from 'bcryptjs';
import { env } from './env';

/**
 * Production cost everywhere except under test: a single `registerUser()` in an integration test
 * hashes the password and 8 recovery codes (`RecoveryCodeService.generateCodes`), ~570ms at cost 12
 * - time that validates nothing beyond "bcrypt works". Cost 4 brings that down to ~2ms without
 * touching the value used in production.
 *
 * `bcryptjs` (pure JS) instead of the native `bcrypt` addon: Keres Server's `bun build --compile`
 * has to load the module on the GitHub Actions runner (Node 24 / ABI 137 on Windows), and the native
 * one publishes no prebuild for that combination. The `$2b$` hashes are the same - already-stored
 * passwords stay valid.
 */
export const BCRYPT_COST = env.NODE_ENV === 'test' ? 4 : 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
