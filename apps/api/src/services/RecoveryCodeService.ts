import { and, eq } from 'drizzle-orm';
import { comparePassword, hashPassword } from '../config/bcrypt';
import { db } from '../db';
import { users, userRecoveryCodes } from '../db/schema';
import { createAttemptLimiter } from '../utils/rateLimiter';

export class InvalidRecoveryCodeError extends Error {
  constructor() {
    super('Invalid username or recovery code.');
    this.name = 'InvalidRecoveryCodeError';
  }
}

/** No ambiguous characters (0/O, 1/I/L) - the code is read and typed by hand. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODES_PER_USER = 8;

/** Without this, the endpoint would be the only one in the API accepting unlimited attempts with no */
const recoveryAttemptLimiter = createAttemptLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
});

function generatePlainCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let raw = '';
  for (const byte of bytes) {
    raw += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

/**
 * Backup codes for recovering an account without knowing the current password - the alternative to
 * requiring the current password (`UserService.changeOwnPassword`), which defeats the purpose of "I
 * forgot my password". Shown in plain text only once (at registration or when regenerating); from
 * then on only each one's bcrypt hash is stored, like the password.
 *
 * With no table indexable by hash (bcrypt salts each one differently), verification compares the code
 * against every unused code of the user - acceptable for a batch of 8.
 */
export class RecoveryCodeService {
  /** Generates a new batch, discarding any previous code (used or not). */
  async generateCodes(userId: string): Promise<string[]> {
    const plainCodes = Array.from({ length: CODES_PER_USER }, generatePlainCode);
    const rows = await Promise.all(
      plainCodes.map(async (code) => ({
        userId,
        codeHash: await hashPassword(code),
      })),
    );

    await db.transaction(async (tx) => {
      await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, userId));
      await tx.insert(userRecoveryCodes).values(rows);
    });

    return plainCodes;
  }

  async countRemaining(userId: string): Promise<number> {
    const rows = await db.query.userRecoveryCodes.findMany({
      where: and(eq(userRecoveryCodes.userId, userId), eq(userRecoveryCodes.isUsed, false)),
      columns: { id: true },
    });
    return rows.length;
  }

  /**
   * Consumes a valid, unused code and changes the password. The code is marked used inside the very
   * transaction that changes the password, so a failure halfway through does not leave the code "half
   * spent" - either both effects happen or neither does.
   */
  async redeemCode(
    username: string,
    plainCode: string,
    newPassword: string,
  ): Promise<{ id: string; username: string; tag: string }> {
    if (!recoveryAttemptLimiter.registerAttempt(username)) {
      throw new InvalidRecoveryCodeError();
    }

    // isDeleted excluded here too - otherwise a soft-deleted account could bypass the same
    // restriction on /auth/login simply by resetting its password through this endpoint instead.
    const user = await db.query.users.findFirst({
      where: and(eq(users.username, username), eq(users.isDeleted, false)),
    });
    if (!user) {
      throw new InvalidRecoveryCodeError();
    }

    const candidates = await db.query.userRecoveryCodes.findMany({
      where: and(eq(userRecoveryCodes.userId, user.id), eq(userRecoveryCodes.isUsed, false)),
    });

    let matched: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await comparePassword(plainCode, candidate.codeHash)) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      throw new InvalidRecoveryCodeError();
    }

    const hashedPassword = await hashPassword(newPassword);
    await db.transaction(async (tx) => {
      // Claim the code in the same write that changes the password. Two requests can both read an
      // unused code before either transaction begins; the `isUsed = false` predicate makes the
      // second writer observe that the first one already consumed it instead of resetting the
      // password a second time with the same recovery secret.
      const [claimed] = await tx
        .update(userRecoveryCodes)
        .set({ isUsed: true, usedAt: new Date() })
        .where(and(eq(userRecoveryCodes.id, matched!.id), eq(userRecoveryCodes.isUsed, false)))
        .returning({ id: userRecoveryCodes.id });
      if (!claimed) {
        throw new InvalidRecoveryCodeError();
      }
      await tx
        .update(users)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    });

    recoveryAttemptLimiter.clearAttempts(username);
    return { id: user.id, username: user.username, tag: user.tag };
  }
}

export const recoveryCodeService = new RecoveryCodeService();
