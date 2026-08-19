import { Elysia, t } from 'elysia';
import type { PublicationLabelMode, ShowcaseVisibility } from '@keres/shared';
import { JWTPayload } from '../../index';
import { storyPublicationService } from '../../services/StoryPublicationService';

/** Uma linha de `story_publications` como o dono a vê. */
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
 * As rotas de publicação do lado do dono. Montadas dentro de `/stories` (ver
 * `story.route.ts`), separadas em arquivo próprio porque não têm nada a ver com o
 * create/export/import que já morava lá - só compartilham o prefixo.
 */
export const publicationRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  // Mesmo caso de `friend.route.ts`: toda rota aqui exige exatamente a mesma coisa, um usuário
  // autenticado. A dona-da-história é checada no serviço, que é quem sabe ler `stories.userId`.
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
      ),
    {
      params: t.Object({ storyId: t.String() }),
      body: t.Object({
        operationVersion: t.Integer({ minimum: 0 }),
        labelMode: t.Optional(
          t.Union([t.Literal('version'), t.Literal('date'), t.Literal('both')]),
        ),
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
