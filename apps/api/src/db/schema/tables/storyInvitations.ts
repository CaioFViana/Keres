import { storyPermissionTypeEnum } from '../enums';
import { table, text, timestampNow, unique } from '../columns';
import { stories } from './stories';
import { users } from './users';

/**
 * An owner's offer of access to a story, waiting for the invitee's answer. Access itself lives in
 * `story_permissions`, and only accepting creates that row - so nothing that reads permissions (sync,
 * media, realtime, publications) ever sees an invitation. Declining, cancelling, unfriending or
 * accepting deletes the row: an invitation has no history worth keeping.
 */
export const storyInvitations = table(
  'story_invitations',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id),
    inviteeId: text('invitee_id')
      .notNull()
      .references(() => users.id),
    permissionType: storyPermissionTypeEnum('permission_type').notNull(),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
  },
  (table) => ({
    // One open invitation per person and story: inviting again only changes its role.
    storyInviteeUnq: unique('story_invitations_story_invitee_unq').on(
      table.storyId,
      table.inviteeId,
    ),
  }),
);
