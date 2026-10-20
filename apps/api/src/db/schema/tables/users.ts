import { relations, sql } from 'drizzle-orm';
import { boolean, table, text, timestamp, timestampNow, uniqueIndex } from '@/db/schema/columns';
import { operationLog } from './operationLog';
import { stories } from './stories';
import { storyPermissions } from './storyPermissions';
import { tiers } from './tiers';

/**
 * Where an account stands in age verification (see `docs/compliance/age_verification.md`). `active` is every normal account -
 * and every account where verification is off. `pending` waits for the service's decision on its first sending;
 * `rejected` is an account whose last sending was refused or expired (it may send again, or be closed).
 */
export const USER_VERIFICATION_STATUSES = ['active', 'pending', 'rejected'] as const;
export type UserVerificationStatus = (typeof USER_VERIFICATION_STATUSES)[number];

export const users = table(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull().unique(),
    /**
     * Freely-changeable handle used for friend discovery (e.g. "@caio"), distinct from
     * `username` which is the login credential and can't be casually renamed. Uniqueness
     * is enforced case-insensitively via the index below, since "Caio" and "caio" being
     * two different addressable friends would be confusing.
     */
    tag: text('tag').notNull(),
    password: text('password').notNull(),
    /** Hex color for the avatar background; `null` until the user picks one (see Avatar.tsx). */
    avatarColor: text('avatar_color'),
    /** Stored icon name for the avatar (a plain Ionicons name or `keres:<name>`); `null` until the user picks one. */
    avatarIcon: text('avatar_icon'),
    /** Free-text profile description, capped at 200 chars (enforced in UpdateUserProfileSchema). */
    bio: text('bio'),
    /** Grants access to the /admin panel and /api/admin/* routes. Checked from the DB per request, never trusted from the JWT. */
    isAdmin: boolean('is_admin').notNull().default(false),
    /**
     * Manual +18 verification, set by an administrator. Gates access to NSFW stories and their
     * showcase entries. Checked from the DB per request, never trusted from the JWT.
     */
    isAdultVerified: boolean('is_adult_verified').notNull().default(false),
    /**
     * The account's own, private choice to see adults-only stories in the public showcase and reader. It counts only
     * while `isAdultVerified` holds (see `ShowcaseService.viewerIncludesNsfw`); revoking the verification resets it.
     * Collaboration on +18 stories does not read it.
     */
    showNsfw: boolean('show_nsfw').notNull().default(false),
    /** Age-verification standing of the account itself (see `USER_VERIFICATION_STATUSES`). */
    verificationStatus: text('verification_status', { enum: USER_VERIFICATION_STATUSES })
      .notNull()
      .default('active'),
    /** When `isAdultVerified` was granted by the service's approval; null for accounts never verified that way. */
    verifiedAt: timestamp('verified_at'),
    /** How the approval was checked (the service's method name); null when there is none. */
    verificationMethod: text('verification_method'),
    /** `null` = no tier assigned; TierEnforcementService falls back to the registration settings' default tier, then to unlimited. */
    tierId: text('tier_id').references(() => tiers.id),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [uniqueIndex('users_tag_lower_idx').on(sql`lower(${table.tag})`)],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  stories: many(stories),
  storyPermissions: many(storyPermissions),
  operationLogs: many(operationLog),
  tier: one(tiers, {
    fields: [users.tierId],
    references: [tiers.id],
  }),
}));
