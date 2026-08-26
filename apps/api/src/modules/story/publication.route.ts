import { Elysia, t } from 'elysia';
import type { PublicationLabelMode, ShowcaseVisibility } from '@keres/shared';
import type { JWTPayload } from '../../index';
import { storyPublicationService } from '../../services/StoryPublicationService';

/** A `story_publications` row as its owner sees it. */
const PublicationResponseSchema = t.Object({
  id: t.String(),
  storyId: t.String(),
  ownerUserId: t.String(),
  label: t.String(),
  operationVersion: t.Number(),
  formatVersion: t.Number(),
  byteSize: t.Number(),
  mediaIncluded: t.Number(),
  mediaTotal: t.Number(),
  createdAt: t.Date(),
});

/**
 * The owner-side publication routes. Mounted inside `/stories` (see `story.route.ts`), split into a
 * file of their own because they have nothing to do with the create/export/import that already lived
 * there - they only share the prefix.
 */
export const publicationRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  // Same case as `friend.route.ts`: every route here requires exactly the same thing, an authenticated
  // user. Story ownership is checked in the service, which is what knows how to read `stories.userId`.
  .derive(({ user, set }) => {
    if (!user?.userId) {
      set.status = 401;
      throw new Error('Unauthorized: User not authenticated.');
    }
    return { userId: user.userId };
  })
  .get('/publications/mine', async ({ userId }) => storyPublicationService.listVisibleTo(userId), {
    response: t.Array(PublicationResponseSchema),
    detail: {
      summary: 'List every publication the user can see',
      description:
        'Publications for stories the user owns or holds a permission on. The client diffs this against its local mirror to notify about versions published while it was offline.',
      tags: ['Showcase'],
    },
  })
  .post(
    '/:storyId/publications',
    async ({ params, body, userId }) =>
      storyPublicationService.publish(
        userId,
        params.storyId,
        body.operationVersion,
        (body.labelMode ?? 'both') as PublicationLabelMode,
        (body.visibility ?? 'public') as ShowcaseVisibility,
        body.password,
      ),
    {
      params: t.Object({ storyId: t.String() }),
      body: t.Object({
        operationVersion: t.Integer({ minimum: 0 }),
        labelMode: t.Optional(
          t.Union([t.Literal('version'), t.Literal('date'), t.Literal('both')]),
        ),
        /**
         * Sent on every publication, not only when it changes: it is the choice the person made for this
         * publication. Omitting it is equivalent to `public`, so publishing without asking for a password
         * really does make the story public, even if an earlier publication had one.
         */
        visibility: t.Optional(t.Union([t.Literal('public'), t.Literal('password')])),
        password: t.Optional(t.String({ minLength: 4, maxLength: 200 })),
      }),
      detail: {
        summary: 'Publish a new public version of a story',
        description:
          'Owner only. Packages the story exactly like the client export does (story.json + media) and stores it as an immutable version. Rejects with 409 when the story is not in sync with the server. Only the newest 5 versions are kept.',
        tags: ['Showcase'],
      },
    },
  )
  .get(
    '/:storyId/publications',
    async ({ params, userId }) => storyPublicationService.listForStory(userId, params.storyId),
    {
      params: t.Object({ storyId: t.String() }),
      detail: {
        summary: 'List the published versions of a story',
        description: 'Owner only. Includes the current showcase visibility and label style.',
        tags: ['Showcase'],
      },
    },
  )
  .put(
    '/:storyId/showcase',
    async ({ params, body, userId }) =>
      storyPublicationService.setVisibility(
        userId,
        params.storyId,
        body.visibility as ShowcaseVisibility,
        body.password,
      ),
    {
      params: t.Object({ storyId: t.String() }),
      body: t.Object({
        visibility: t.Union([t.Literal('public'), t.Literal('password')]),
        password: t.Optional(t.String({ minLength: 4, maxLength: 200 })),
      }),
      detail: {
        summary: 'Change a published story visibility',
        description:
          'Owner only. Switches between listed-and-public and unlisted-behind-a-password, or rotates the password.',
        tags: ['Showcase'],
      },
    },
  )
  .delete(
    '/:storyId/publications/:publicationId',
    async ({ params, userId }) => {
      await storyPublicationService.deletePublication(userId, params.storyId, params.publicationId);
      return { deleted: true };
    },
    {
      params: t.Object({ storyId: t.String(), publicationId: t.String() }),
      response: t.Object({ deleted: t.Boolean() }),
      detail: {
        summary: 'Delete one published version',
        description:
          'Owner only. Removing the last version also unlists the story - there would be nothing left to show.',
        tags: ['Showcase'],
      },
    },
  )
  .delete(
    '/:storyId/publications',
    async ({ params, userId }) => {
      await storyPublicationService.unpublish(userId, params.storyId);
      return { deleted: true };
    },
    {
      params: t.Object({ storyId: t.String() }),
      response: t.Object({ deleted: t.Boolean() }),
      detail: {
        summary: 'Unpublish a story',
        description: 'Owner only. Removes the story from the showcase along with every version.',
        tags: ['Showcase'],
      },
    },
  );
