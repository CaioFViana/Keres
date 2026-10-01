import { CreateStoryInvitationSchema, StoryIdParam, StoryInvitationIdParam } from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { storyInvitationService } from '../../services/StoryInvitationService';
import { AppError } from '../../utils/errors';

const StoryInvitationResponseSchema = t.Object({
  id: t.String(),
  storyId: t.String(),
  storyTitle: t.String(),
  inviterId: t.String(),
  inviterUsername: t.String(),
  inviteeId: t.String(),
  inviteeUsername: t.String(),
  permissionType: t.String(),
  createdAt: t.String(),
});

/**
 * Story invitations, part of the friendship system: an owner offers a friend a role on a story, and
 * the friend accepts or declines it - access starts only on acceptance. Mounted at
 * `/friend/story-invitations`.
 */
export const storyInvitationRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  .derive(({ user }) => {
    if (!user?.userId) {
      throw new AppError(401, 'Unauthorized: User not authenticated.');
    }
    return { userId: user.userId };
  })
  .get('/', async ({ userId }) => storyInvitationService.listForUser(userId), {
    response: t.Array(StoryInvitationResponseSchema),
    detail: {
      summary: 'List open story invitations',
      description: 'Every open invitation the user sent or received.',
      tags: ['Story Invitations'],
    },
  })
  .get(
    '/story/:storyId',
    async ({ params, userId }) => storyInvitationService.listForStory(userId, params.storyId),
    {
      params: StoryIdParam,
      response: t.Array(StoryInvitationResponseSchema),
      detail: {
        summary: "List a story's open invitations",
        description: 'For the story owner: who was invited and has not answered yet.',
        tags: ['Story Invitations'],
      },
    },
  )
  .post(
    '/',
    async ({ body, userId }) =>
      storyInvitationService.invite(userId, body.storyId, body.targetUserId, body.permissionType),
    {
      body: CreateStoryInvitationSchema,
      response: StoryInvitationResponseSchema,
      detail: {
        summary: 'Invite a friend to a story',
        description:
          'The story owner offers a friend a reader or writer role. Inviting somebody already invited changes the offered role; somebody who already collaborates is refused (409).',
        tags: ['Story Invitations'],
      },
    },
  )
  .put(
    '/:invitationId/accept',
    async ({ params, userId }) => storyInvitationService.accept(userId, params.invitationId),
    {
      params: StoryInvitationIdParam,
      response: t.Object({ storyId: t.String() }),
      detail: {
        summary: 'Accept a story invitation',
        description:
          'The invitee takes the offered role: access is granted and the story becomes downloadable. 410 when the story or the friendship is gone.',
        tags: ['Story Invitations'],
      },
    },
  )
  .delete(
    '/:invitationId',
    async ({ params, userId }) => {
      await storyInvitationService.remove(userId, params.invitationId);
      return { message: 'Invitation closed.' };
    },
    {
      params: StoryInvitationIdParam,
      response: t.Object({ message: t.String() }),
      detail: {
        summary: 'Decline or withdraw a story invitation',
        description: 'Declined by the invitee or withdrawn by the owner.',
        tags: ['Story Invitations'],
      },
    },
  );
