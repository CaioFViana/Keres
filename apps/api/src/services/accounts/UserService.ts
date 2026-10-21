import type {
  OwnPublicProfile,
  UpdateOwnPublicProfileType,
  UpdateUserPreferencesType,
  UpdateUserProfileType,
  UserPreferencesType,
  UserPublicInfo,
} from '@keres/shared';
import { ACCOUNT_DELETION_GRACE_DAYS, deriveUserTag, normalizeUserTag } from '@keres/shared';
import { randomUUID } from 'node:crypto';
import { and, eq, lt, notLike, sql } from 'drizzle-orm';
import { comparePassword, hashPassword } from '@/config/bcrypt';
import { db } from '@/db';
import { users, type UserVerificationStatus } from '@/db/schema/tables/users';
import { isUniqueViolation, postgresErrorConstraint } from '@/utils/errors';
import { auditService } from '@/services/compliance/AuditService';
import { erasureLedger } from '@/services/compliance/ErasureLedger';
import { effectiveAdultVerified } from '@/services/age-verification/ageVerificationMode';
import { recoveryCodeService } from '@/services/auth/RecoveryCodeService';

export class TagAlreadyTakenError extends Error {
  constructor() {
    super('Tag is already taken.');
    this.name = 'TagAlreadyTakenError';
  }
}

/** Setting the adults-only preference needs a verified account; clearing it never does. */
export class AdultVerificationRequiredError extends Error {
  constructor() {
    super('Only age-verified (+18) accounts can show adults-only content.');
    this.name = 'AdultVerificationRequiredError';
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
 * sign-in (see `docs/compliance/age_verification.md`). Every lookup of another account filters on this, so it is written once.
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

  /** What the author wrote for the showcase's author page. Undefined when there is no such account. */
  async getPublicProfile(userId: string): Promise<OwnPublicProfile | undefined> {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { profileBiography: true, profileLinks: true, profileTheme: true },
    });
    if (!row) return undefined;
    return {
      biography: row.profileBiography,
      links: row.profileLinks,
      theme: row.profileTheme,
    };
  }

  /**
   * Writes the author page's texts. A field left out stays as it was; an empty biography is stored as none, and its
   * line breaks are normalized to LF whatever the device sent.
   */
  async updatePublicProfile(
    userId: string,
    profile: UpdateOwnPublicProfileType,
  ): Promise<OwnPublicProfile> {
    const changes: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (profile.biography !== undefined) {
      changes.profileBiography = profile.biography?.replace(/\r\n?/g, '\n').trim() || null;
    }
    if (profile.links !== undefined) {
      changes.profileLinks = profile.links;
    }
    if (profile.theme !== undefined) {
      changes.profileTheme = profile.theme;
    }
    const [updated] = await db.update(users).set(changes).where(eq(users.id, userId)).returning({
      biography: users.profileBiography,
      links: users.profileLinks,
      theme: users.profileTheme,
    });
    if (!updated) {
      throw new Error('User not found.');
    }
    return updated;
  }

  /**
   * The owner's private preferences, with the verification they depend on. Undefined when there is no such account.
   * Never part of the public shape (`PUBLIC_INFO_COLUMNS`).
   */
  async getPreferences(userId: string): Promise<UserPreferencesType | undefined> {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { showNsfw: true, isAdultVerified: true },
    });
    if (!row) return undefined;
    return {
      showNsfw: row.showNsfw,
      isAdultVerified: effectiveAdultVerified(row.isAdultVerified),
    };
  }

  /**
   * Sets the adults-only preference. Turning it on is refused unless the account is verified; the condition is part of
   * the UPDATE itself, so a revocation that lands in between cannot leave the flag on.
   */
  async updatePreferences(
    userId: string,
    preferences: UpdateUserPreferencesType,
  ): Promise<UserPreferencesType> {
    const [updated] = await db
      .update(users)
      .set({ showNsfw: preferences.showNsfw, updatedAt: new Date() })
      .where(
        preferences.showNsfw
          ? and(eq(users.id, userId), eq(users.isAdultVerified, true))
          : eq(users.id, userId),
      )
      .returning({ showNsfw: users.showNsfw, isAdultVerified: users.isAdultVerified });

    if (!updated) {
      if (preferences.showNsfw) {
        throw new AdultVerificationRequiredError();
      }
      throw new Error('User not found.');
    }
    return {
      showNsfw: updated.showNsfw,
      isAdultVerified: effectiveAdultVerified(updated.isAdultVerified),
    };
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
    erasureLedger.record('account_deleted', userId);
  }

  /**
   * Erases the personal data of accounts deleted past the grace period. Pseudonymizes instead
   * of deleting rows: stories, permissions and messages keep pointing at a stable account id, so
   * contributions to shared stories survive, while everything that names or reaches the person
   * (username, tag, bio, the author page's texts, avatar) is scrubbed. Usernames and tags are freed by the same move.
   * Pseudonymous, not anonymous: the surviving id still links that account's contributions and
   * acceptance proof together - it simply no longer resolves to anyone.
   *
   * Kept on purpose (the law's exceptions to erasure): the terms-acceptance rows (minimal proof
   * of which version was accepted), financial records, and the activity record - whose lines are
   * scrubbed of this account's ids and names by `scrubUser` but otherwise stay as long as the
   * retention says. The access records (sign-ins and their addresses, Marco Civil art. 15) are
   * not touched here at all: the law keeps them six months whatever the account did, and
   * `AccessRecordService.pruneExpired` is what drops them.
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
      await this.eraseAccount(row.id);
    }
    return expired.length;
  }

  /**
   * The erasure itself, for one account: the scrub `pruneDeletedAccounts` does once the grace is over, and what the
   * erasure ledger replays after a restore. Written to the ledger first, so a crash in between cannot lose it.
   */
  async eraseAccount(userId: string): Promise<void> {
    erasureLedger.record('account_erased', userId);
    await db
      .update(users)
      .set({
        username: `deleted:${userId}`,
        tag: `deleted_${userId.toLowerCase()}`,
        password: await hashPassword(`deleted:${randomUUID()}`),
        avatarColor: null,
        avatarIcon: null,
        bio: null,
        profileBiography: null,
        profileLinks: [],
        profileTheme: null,
        tierId: null,
        isAdultVerified: false,
        showNsfw: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    // The trail keeps its lines but loses who they speak of: ids and names go, the events stay
    // as long as the retention says.
    await auditService.scrubUser(userId);
  }
}

export const userService = new UserService();
