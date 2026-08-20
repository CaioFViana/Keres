import { relations, sql } from 'drizzle-orm';
import { boolean, table, text, timestamp, timestampNow, uniqueIndex } from '../columns';
import { operationLog } from './operationLog';
import { stories } from './stories';
import { storyPermissions } from './storyPermissions';
import { tiers } from './tiers';

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
    /** Ionicons glyph name for the avatar; `null` until the user picks one. */
    avatarIcon: text('avatar_icon'),
    /** Free-text profile description, capped at 200 chars (enforced in UpdateUserProfileSchema). */
    bio: text('bio'),
    /** Grants access to the /admin panel and /admin/api/* routes. Checked from the DB per request, never trusted from the JWT. */
    isAdmin: boolean('is_admin').notNull().default(false),
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
