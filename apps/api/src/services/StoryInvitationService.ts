import type { StoryInvitation } from '@keres/shared';
import { and, eq, or } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, withWriteTransaction } from '../db';
import { alias } from '../db/schema/columns';
import { stories, storyInvitations, users } from '../db/schema';
import { emitUserEvent } from '../modules/webSocket/webSocket.route';
import { AppError } from '../utils/errors';
import { storyPermissionService } from './StoryPermissionService';

type PermissionType = 'reader' | 'writer';

/**
 * Collaboration by invitation, the way friendship works: the owner offers a role on a story to a
 * friend, and access (a `story_permissions` row, and with it the download) only exists once the friend
 * accepts. Before this, adding a collaborator granted access at once and pushed the story to their
 * devices unasked.
 */
export class StoryInvitationService {
  private notify(...userIds: string[]): void {
    for (const userId of new Set(userIds)) {
      emitUserEvent(userId, { type: 'story-invitations.changed' });
    }
  }

  /** Invitations joined with the story title and both names, filtered by `where`. */
  private async enriched(where: ReturnType<typeof and>): Promise<StoryInvitation[]> {
    const inviter = alias(users, 'inviter');
    const invitee = alias(users, 'invitee');
    const rows = await db
      .select({
        id: storyInvitations.id,
        storyId: storyInvitations.storyId,
        storyTitle: stories.title,
        inviterId: storyInvitations.inviterId,
        inviterUsername: inviter.username,
        inviteeId: storyInvitations.inviteeId,
        inviteeUsername: invitee.username,
        permissionType: storyInvitations.permissionType,
        createdAt: storyInvitations.createdAt,
      })
      .from(storyInvitations)
      .innerJoin(stories, eq(storyInvitations.storyId, stories.id))
      .innerJoin(inviter, eq(storyInvitations.inviterId, inviter.id))
      .innerJoin(invitee, eq(storyInvitations.inviteeId, invitee.id))
      // A deleted story has nothing left to offer: its invitations stop showing up.
      .where(and(where, eq(stories.isDeleted, false)));
    return rows.map((row) => ({
      ...row,
      permissionType: row.permissionType as PermissionType,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** Every open invitation the user sent or received, on any story. */
  async listForUser(userId: string): Promise<StoryInvitation[]> {
    return this.enriched(
      or(eq(storyInvitations.inviterId, userId), eq(storyInvitations.inviteeId, userId)),
    );
  }

  /** The story's open invitations, for its owner's collaborator list. */
  async listForStory(ownerUserId: string, storyId: string): Promise<StoryInvitation[]> {
    await this.requireOwner(ownerUserId, storyId);
    return this.enriched(eq(storyInvitations.storyId, storyId));
  }

  async invite(
    ownerUserId: string,
    storyId: string,
    inviteeId: string,
    permissionType: PermissionType,
  ): Promise<StoryInvitation> {
    if (ownerUserId === inviteeId) {
      throw new AppError(400, 'The story owner cannot be invited to their own story.');
    }
    await this.requireOwner(ownerUserId, storyId);
    const invitee = await db.query.users.findFirst({ where: eq(users.id, inviteeId) });
    if (!invitee || invitee.isDeleted) {
      throw new AppError(404, 'Target user not found.');
    }
    if (!(await storyPermissionService.areFriends(ownerUserId, inviteeId))) {
      throw new AppError(403, 'Only friends can be invited to a story.');
    }
    if (await storyPermissionService.getUserPermissionForStory(inviteeId, storyId)) {
      throw new AppError(
        409,
        'This user already collaborates on the story; change their role instead.',
      );
    }

    const now = new Date();
    await db
      .insert(storyInvitations)
      .values({
        id: ulid(),
        storyId,
        inviterId: ownerUserId,
        inviteeId,
        permissionType,
        createdAt: now,
        updatedAt: now,
      })
      // Inviting somebody already invited only changes the offered role.
      .onConflictDoUpdate({
        target: [storyInvitations.storyId, storyInvitations.inviteeId],
        set: { permissionType, updatedAt: now },
      });

    this.notify(ownerUserId, inviteeId);
    const [created] = await this.enriched(
      and(eq(storyInvitations.storyId, storyId), eq(storyInvitations.inviteeId, inviteeId)),
    );
    return created;
  }

  /**
   * The invitee takes the offered role: access is granted and the invitation disappears in one
   * transaction, then the invitee's devices hear about a story they can now download.
   */
  async accept(userId: string, invitationId: string): Promise<{ storyId: string }> {
    const invitation = await this.findInvolving(userId, invitationId);
    if (invitation.inviteeId !== userId) {
      throw new AppError(403, 'Only the invited user can accept an invitation.');
    }
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, invitation.storyId), eq(stories.userId, invitation.inviterId)),
    });
    const stillFriends = await storyPermissionService.areFriends(invitation.inviterId, userId);
    if (!story || story.isDeleted || !stillFriends) {
      // The offer outlived what it offered: drop it rather than leave a button that always fails.
      await db.delete(storyInvitations).where(eq(storyInvitations.id, invitation.id));
      this.notify(invitation.inviterId, userId);
      throw new AppError(410, 'This invitation is no longer valid.');
    }

    await withWriteTransaction(async (tx) => {
      await storyPermissionService.grantAccess(
        invitation.storyId,
        userId,
        invitation.permissionType as PermissionType,
        tx,
      );
      await tx.delete(storyInvitations).where(eq(storyInvitations.id, invitation.id));
    });
    // Unfriending can land between the check above and the grant, and its cleanup would then have
    // run before the permission existed. Checking again closes that window: a friendship that lost
    // the race never leaves usable access behind.
    if (!(await storyPermissionService.areFriends(invitation.inviterId, userId))) {
      await storyPermissionService.deleteAccessBetweenUsers(invitation.inviterId, userId);
      this.notify(invitation.inviterId, userId);
      throw new AppError(410, 'This invitation is no longer valid.');
    }

    emitUserEvent(userId, { type: 'stories.catalog-changed' });
    this.notify(invitation.inviterId, userId);
    return { storyId: invitation.storyId };
  }

  /** Declined by the invitee or withdrawn by the owner - either side may close an invitation. */
  async remove(userId: string, invitationId: string): Promise<void> {
    const invitation = await this.findInvolving(userId, invitationId);
    await db.delete(storyInvitations).where(eq(storyInvitations.id, invitation.id));
    this.notify(invitation.inviterId, invitation.inviteeId);
  }

  /** 404 for anybody outside the invitation: its existence is not theirs to learn. */
  private async findInvolving(userId: string, invitationId: string) {
    const invitation = await db.query.storyInvitations.findFirst({
      where: and(
        eq(storyInvitations.id, invitationId),
        or(eq(storyInvitations.inviterId, userId), eq(storyInvitations.inviteeId, userId)),
      ),
    });
    if (!invitation) throw new AppError(404, 'Invitation not found.');
    return invitation;
  }

  private async requireOwner(userId: string, storyId: string): Promise<void> {
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.userId, userId), eq(stories.isDeleted, false)),
    });
    if (!story) throw new AppError(403, 'Unauthorized: Story not found or not owned by user.');
  }
}

export const storyInvitationService = new StoryInvitationService();
