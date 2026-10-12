import type { UpdateUserProfileType, UserPublicInfo } from '@keres/shared';
import { ACCOUNT_DELETION_GRACE_DAYS, deriveUserTag, normalizeUserTag } from '@keres/shared';
import { randomUUID } from 'node:crypto';
import { and, eq, lt, notLike, sql } from 'drizzle-orm';
import { comparePassword, hashPassword } from '../config/bcrypt';
import { db } from '../db';
import { users, type UserVerificationStatus } from '../db/schema/tables/users';
import { isUniqueViolation, postgresErrorConstraint } from '../utils/errors';
import { auditService } from './AuditService';
import { effectiveAdultVerified } from './ageVerification/ageVerificationMode';
import { recoveryCodeService } from './RecoveryCodeService';

export class TagAlreadyTakenError extends Error {
  constructor() {
    super('Tag is already taken.');
    this.name = 'TagAlreadyTakenError';
  }
}

export class InvalidCurrentPasswordError extends Error {
  constructor() {
    super('Current password is incorrect.');
    this.name = 'InvalidCurrentPasswordError';
  }
}

// Shape differs between Drizzle's two query builders: the relational API (`db.query.users.
// findFirst`) takes `{ column: true }`, the core API's `.returning()` takes `{ alias: table.column }`.
const PUBLIC_INFO_COLUMNS = {
  id: true,
  username: true,
  tag: true,
  avatarColor: true,
  avatarIcon: true,
  bio: true,
  isAdultVerified: true,
} as const;

const PUBLIC_INFO_RETURNING = {
  id: users.id,
  username: users.username,
  tag: users.tag,
  avatarColor: users.avatarColor,
  avatarIcon: users.avatarIcon,
  bio: users.bio,
  isAdultVerified: users.isAdultVerified,
};

/**
 * Only an active account is ever shown to another person: a pending or refused one is found by nobody but its own
 * sign-in (see `docs/age_verification.md`). Every lookup of another account filters on this, so it is written once.
 */
export const ACTIVE_ACCOUNT = eq(users.verificationStatus, 'active');

/** The public shape of an account, with the adults-only flag as this server reads it (`effectiveAdultVerified`). */
function publicInfoOf<T extends { isAdultVerified: boolean }>(row: T): T {
  return { ...row, isAdultVerified: effectiveAdultVerified(row.isAdultVerified) };
}

export class UserService {
  /** Live account used at login: a soft-deleted row must fail like a missing one. */
  async findLiveByUsername(username: string) {
    return db.query.users.findFirst({
      where: and(eq(users.username, username), eq(users.isDeleted, false)),
    });
  }

  async isUsernameTaken(username: string): Promise<boolean> {
    const existing = await db.query.users.findFirst({
      where: eq(users.username, username),
      columns: { id: true },
    });
    return !!existing;
  }

  async isLiveUser(userId: string): Promise<boolean> {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.isDeleted, false)),
      columns: { id: true },
    });
    return !!user;
  }

  /** Whether another person may see this account at all: it is active in age verification (see ACTIVE_ACCOUNT). */
  async isActiveUser(userId: string): Promise<boolean> {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, userId), ACTIVE_ACCOUNT),
      columns: { id: true },
    });
    return !!user;
  }

  /**
   * The account's standing as its own sessions and verification routes read it: its status, and whether it is closed.
   * Undefined when there is no such account at all.
   */
  async verificationStanding(
    userId: string,
  ): Promise<{ verificationStatus: UserVerificationStatus; isDeleted: boolean } | undefined> {
    return db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { verificationStatus: true, isDeleted: true },
    });
  }

  /**
   * Whether a session issued to this account now carries the `pending` claim: it is not active. A missing account
   * counts as pending, so a session is never issued to what cannot be found.
   */
  async isPendingVerification(userId: string): Promise<boolean> {
    const standing = await this.verificationStanding(userId);
    return standing?.verificationStatus !== 'active';
  }

  /**
   * Removes an account that was inserted a moment ago by the same request, when the rest of that request failed (the
   * verification service's sending could not be recorded). Nothing else refers to it yet.
   */
  async discardNewAccount(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  /**
   * Inserts a new account, its tag made from the username (a slug: lowercase, no spaces - see
   * `deriveUserTag`). On a tag collision, retries with a unique suffix. Returns `taken`
   * when the username is already claimed, including a race between the pre-check and the insert.
   * `verificationStatus` is set only where registration waits for the service (`required` mode); otherwise the
   * account is active from the start.
   */
  async createAccount(input: {
    id: string;
    username: string;
    hashedPassword: string;
    defaultTierId: string | null;
    verificationStatus?: UserVerificationStatus;
  }): Promise<{ id: string; username: string; tag: string } | 'taken'> {
    const values = {
      id: input.id,
      username: input.username,
      password: input.hashedPassword,
      tierId: input.defaultTierId,
      ...(input.verificationStatus ? { verificationStatus: input.verificationStatus } : {}),
    };
    try {
      const [created] = await db
        .insert(users)
        .values({ ...values, tag: deriveUserTag(input.username, input.id) })
        .returning({ id: users.id, username: users.username, tag: users.tag });
      if (!created) throw new Error('Failed to create user');
      return created;
    } catch (error) {
      if (isUniqueViolation(error) && postgresErrorConstraint(error) === 'users_tag_lower_idx') {
        try {
          const [created] = await db
            .insert(users)
            .values({
              ...values,
              tag: deriveUserTag(input.username, input.id, { suffixed: true }),
            })
            .returning({ id: users.id, username: users.username, tag: users.tag });
          if (!created) throw new Error('Failed to create user');
          return created;
        } catch (retryError) {
          if (isUniqueViolation(retryError)) return 'taken';
          throw retryError;
        }
      }
      if (isUniqueViolation(error)) return 'taken';
      throw error;
    }
  }

  /**
   * The account by its id, whoever asks: the caller decides whether it may be shown (see `isActiveUser`), since the
   * account's own sessions read it too (`/auth/me`).
   */
  async getUserById(userId: string): Promise<UserPublicInfo | undefined> {
    const user = await db.query.users.findFirst({
      columns: PUBLIC_INFO_COLUMNS,
      where: eq(users.id, userId),
    });
    return user ? publicInfoOf(user) : undefined;
  }

  // The tag is read the way it is stored (`normalizeUserTag`): "@Caio Viana", "caio viana" and
  // "CAIO_VIANA" are all the same person. The comparison stays case-insensitive on the column too,
  // matching the uniqueness it enforces (see users_tag_lower_idx).
  // Another person's lookup: only an active account is found (see ACTIVE_ACCOUNT).
  async getUserByTag(tag: string): Promise<UserPublicInfo | undefined> {
    const wanted = normalizeUserTag(tag);
    if (!wanted) return undefined;
    const user = await db.query.users.findFirst({
      columns: PUBLIC_INFO_COLUMNS,
      where: and(sql`lower(${users.tag}) = ${wanted}`, ACTIVE_ACCOUNT),
    });
    return user ? publicInfoOf(user) : undefined;
  }

  async updateUserTag(userId: string, newTag: string): Promise<UserPublicInfo> {
    // Stored in the one shape lookups expect, whoever validated it before.
    const tag = normalizeUserTag(newTag);
    // Any holder counts here, pending ones too: the tag is taken by them whether or not they can be found.
    const holder = await db.query.users.findFirst({
      where: sql`lower(${users.tag}) = ${tag}`,
      columns: { id: true },
    });
    if (holder && holder.id !== userId) {
      throw new TagAlreadyTakenError();
    }

    const [updated] = await db
      .update(users)
      .set({ tag, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning(PUBLIC_INFO_RETURNING);

    if (!updated) {
      throw new Error('User not found.');
    }
    return publicInfoOf(updated);
  }

  async updateUserProfile(userId: string, profile: UpdateUserProfileType): Promise<UserPublicInfo> {
    const [updated] = await db
      .update(users)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning(PUBLIC_INFO_RETURNING);

    if (!updated) {
      throw new Error('User not found.');
    }
    return publicInfoOf(updated);
  }

  /** Self-service: it requires the current password, unlike the admin panel's reset, which ignores it. */
  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { password: true },
    });
    if (!user) {
      throw new Error('User not found.');
    }

    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      throw new InvalidCurrentPasswordError();
    }

    const hashedPassword = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  /** Self-service: it requires the current password, same justification as changeOwnPassword. */
  async regenerateRecoveryCodes(userId: string, currentPassword: string): Promise<string[]> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { password: true },
    });
    if (!user) {
      throw new Error('User not found.');
    }

    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      throw new InvalidCurrentPasswordError();
    }

    return recoveryCodeService.generateCodes(userId);
  }

  /**
   * Self-service deletion: it requires the current password, like changeOwnPassword, and only
   * deactivates - the row stays reserved through the grace period so the username and tag cannot
   * be claimed while recovery is still possible. Login already excludes such rows (see
   * `findLiveByUsername`); the prune below erases them for good.
   */
  async deleteOwnAccount(userId: string, currentPassword: string): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, password: true, isDeleted: true },
    });
    if (!user || user.isDeleted) {
      throw new Error('User not found.');
    }

    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      throw new InvalidCurrentPasswordError();
    }

    await db
      .update(users)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  /**
   * Erases the personal data of accounts deleted past the grace period. Pseudonymizes instead
   * of deleting rows: stories, permissions and messages keep pointing at a stable account id, so
   * contributions to shared stories survive, while everything that names or reaches the person
   * (username, tag, bio, avatar) is scrubbed. Usernames and tags are freed by the same move.
   * Pseudonymous, not anonymous: the surviving id still links that account's contributions and
   * acceptance proof together - it simply no longer resolves to anyone.
   *
   * Kept on purpose (the law's exceptions to erasure): the terms-acceptance rows (minimal proof
   * of which version was accepted), financial records, and the activity record - whose lines are
   * scrubbed of this account's ids, names, ips and agents by `scrubUser` but otherwise stay as
   * long as the retention says.
   */
  async pruneDeletedAccounts(
    graceDays: number = ACCOUNT_DELETION_GRACE_DAYS,
    now: Date = new Date(),
  ): Promise<number> {
    const cutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60_000);
    const expired = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.isDeleted, true),
          lt(users.deletedAt, cutoff),
          // Already scrubbed rows stay untouched: without this every run would re-hash.
          notLike(users.username, 'deleted:%'),
        ),
      );

    for (const row of expired) {
      await db
        .update(users)
        .set({
          username: `deleted:${row.id}`,
          tag: `deleted_${row.id.toLowerCase()}`,
          password: await hashPassword(`deleted:${randomUUID()}`),
          avatarColor: null,
          avatarIcon: null,
          bio: null,
          tierId: null,
          isAdultVerified: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, row.id));
      // The trail keeps its lines but loses who they speak of: ids, names, ips and agents go,
      // the events stay as long as the retention says.
      await auditService.scrubUser(row.id);
    }
    return expired.length;
  }
}

export const userService = new UserService();
