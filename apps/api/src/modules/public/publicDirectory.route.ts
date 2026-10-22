import { ShowcaseAuthorQuerySchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { jwtShowcase } from '@/config/jwt';
import type { JWTPayload } from '@/index';
import { mediaStorageService } from '@/services/media-storage/MediaStorageService';
import { showcaseAuthorService } from '@/services/showcase/ShowcaseAuthorService';
import { showcaseService } from '@/services/showcase/ShowcaseService';
import { showcaseSettingsService } from '@/services/showcase/ShowcaseSettingsService';
import { AppError } from '@/utils/errors';
import { openShowcaseStory } from './showcaseGate';

/**
 * How the public site is browsed beyond its front list: what it can be filtered by, the authors and their pages,
 * and the cover of a released work. Its own module for the same reason the reader's is - a concern of its own -
 * and under the same rules: no route here asks for a session, and none returns what the author did not publish.
 */

export const publicDirectoryRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  .use(jwtShowcase)
  // Like everything else public but the config, these only exist with the Showcase on.
  .onBeforeHandle(async () => {
    if (!(await showcaseSettingsService.isEnabled())) {
      throw new AppError(404, 'Not found.');
    }
  })
  .get(
    '/stories/facets',
    async ({ set, user }) => {
      const includeNsfw = await showcaseService.viewerIncludesNsfw(user);
      // Counted over what this viewer class may see, so the answer varies with it.
      set.headers['vary'] = 'Authorization';
      set.headers['cache-control'] = 'public, max-age=30';
      return showcaseService.facets(includeNsfw);
    },
    {
      detail: {
        summary: 'What the story list can be filtered by',
        description:
          'Genres, languages, released-work mediums and structures of the stories this viewer may see, each with how many carry it.',
        tags: ['Showcase'],
      },
    },
  )
  .get(
    '/authors',
    async ({ set, user, query }) => {
      const parsed = ShowcaseAuthorQuerySchema.safeParse(query);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid search.');
      }
      const includeNsfw = await showcaseService.viewerIncludesNsfw(user);
      set.headers['vary'] = 'Authorization';
      const { items, total } = await showcaseAuthorService.listAuthors(includeNsfw, parsed.data);
      set.headers['x-total-count'] = String(total);
      return items;
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        summary: 'List the authors',
        description:
          'The accounts with at least one story on show to this viewer, most recently active first. q looks in the name; the match count rides in X-Total-Count.',
        tags: ['Showcase'],
      },
    },
  )
  .get(
    '/authors/:username',
    async ({ params, set, user }) => {
      const includeNsfw = await showcaseService.viewerIncludesNsfw(user);
      const page = await showcaseAuthorService.getAuthorPage(params.username, includeNsfw);
      if (!page) {
        // An account with nothing on show answers like one that does not exist.
        throw new AppError(404, 'Not found.');
      }
      set.headers['vary'] = 'Authorization';
      return page;
    },
    {
      params: t.Object({ username: t.String() }),
      detail: {
        summary: "An author's page",
        description:
          "The author's biography, links and theme, written for this page, and the stories this viewer may see. 404 when the account has none on show.",
        tags: ['Showcase'],
      },
    },
  )
  .get(
    '/stories/:storyId/works/:arcId/cover',
    async ({ params, headers, query, jwtShowcase: showcaseJwt, set, user }) => {
      // The same gates as the story's page and cover: a password, an adults-only shelf and a hidden story keep a
      // work's cover too.
      await openShowcaseStory({
        storyId: params.storyId,
        user,
        showcaseJwt,
        credentials: [
          headers['authorization'],
          query.access ? `Showcase ${query.access}` : undefined,
        ],
      });
      const cover = await showcaseService.coverOfWork(params.storyId, params.arcId);
      const stored = cover ? await mediaStorageService.read(cover.hash) : null;
      if (!cover || !stored) {
        throw new AppError(404, 'Not found.');
      }
      set.headers['content-type'] = cover.mimeType;
      set.headers['x-content-type-options'] = 'nosniff';
      set.headers['cache-control'] = (await showcaseService.isNsfwStory(params.storyId))
        ? 'private, max-age=300'
        : 'public, max-age=300';
      return stored.body;
    },
    {
      params: t.Object({ storyId: t.String(), arcId: t.String() }),
      query: t.Object({ access: t.Optional(t.String()) }),
      detail: {
        summary: 'The cover of a released work',
        description:
          'The picture the author chose as the cover of a work (arc) of the story, as it is now. 404 when the work was never released, has none, or is not for this viewer.',
        tags: ['Showcase'],
      },
    },
  );
