import { t, Elysia } from 'elysia';
import { jwtShowcase } from '../../config/jwt';
import type { JWTPayload } from '../../index';
import { publicationStorageService } from '../../services/PublicationStorageService';
import { showcaseService } from '../../services/ShowcaseService';
import { showcaseSettingsService } from '../../services/ShowcaseSettingsService';
import { AppError } from '../../utils/errors';
import { DOWNLOAD_URL_TTL_SECONDS } from './showcaseAccess';
import { assertShowcaseOpen } from './showcaseGate';

/**
 * The online reader of a published version: its page, and the address that opens it. Its own
 * module because it has its own concern (a page of somebody's story, run by the visitor's browser)
 * and its own rules about what that page may do.
 */

/**
 * What a reader page may do when the browser renders it. `sandbox` gives it an opaque origin even
 * when someone opens the address directly (no cookies, no storage, no reaching the showcase page),
 * and nothing may be fetched: the page carries its own story and its own code.
 */
const READER_CSP = [
  'sandbox allow-scripts',
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  'img-src data:',
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export const publicReaderRoutes = new Elysia()
  // Same optional session as the other public routes: the global derive fills `user`.
  .decorate('user', null as JWTPayload | null)
  .use(jwtShowcase)
  // Like everything else public but the config, these only exist with the Showcase on.
  .onBeforeHandle(async () => {
    if (!(await showcaseSettingsService.isEnabled())) {
      throw new AppError(404, 'Not found.');
    }
  })
  .get(
    '/stories/:storyId/publications/:publicationId/reader',
    async ({ params, headers, query, jwtShowcase: showcaseJwt, set, user }) => {
      const entry = await showcaseService.getEntry(params.storyId);
      if (!entry) {
        throw new AppError(404, 'Not found.');
      }
      await assertShowcaseOpen({
        entry,
        storyId: params.storyId,
        user,
        showcaseJwt,
        credentials: [
          headers['authorization'],
          query.access ? `Showcase ${query.access}` : undefined,
        ],
      });

      const publication = await showcaseService.getPublication(
        params.storyId,
        params.publicationId,
      );
      if (!publication || publication.readerByteSize == null) {
        throw new AppError(404, 'Not found.');
      }
      const body = await publicationStorageService.readReader(params.storyId, params.publicationId);
      if (!body) {
        throw new AppError(404, 'Not found.');
      }

      set.headers['content-type'] = 'text/html; charset=utf-8';
      set.headers['content-security-policy'] = READER_CSP;
      set.headers['x-content-type-options'] = 'nosniff';
      set.headers['referrer-policy'] = 'no-referrer';
      // A publication never changes after it is created - but a protected story's page is not
      // for a shared cache, and its address carries a token. Gated (NSFW) content is private too.
      // Keyed on the story's flag, not the viewer class, so verified readers keep shared caching
      // on safe stories.
      set.headers['cache-control'] =
        entry.visibility === 'password' || (await showcaseService.isNsfwStory(params.storyId))
          ? 'private, no-store'
          : 'public, max-age=31536000, immutable';
      return body;
    },
    {
      params: t.Object({ storyId: t.String(), publicationId: t.String() }),
      query: t.Object({ access: t.Optional(t.String()) }),
      detail: {
        summary: 'The online reader of a published version',
        description:
          'Serves the self-contained reading page published alongside the version, sandboxed by its own Content-Security-Policy.',
        tags: ['Showcase'],
      },
    },
  )
  .post(
    '/stories/:storyId/publications/:publicationId/reader/url',
    async ({ params, headers, jwtShowcase: showcaseJwt, user }) => {
      const entry = await showcaseService.getEntry(params.storyId);
      if (!entry) {
        throw new AppError(404, 'Not found.');
      }
      const includeNsfw = await assertShowcaseOpen({
        entry,
        storyId: params.storyId,
        user,
        showcaseJwt,
        credentials: [headers['authorization']],
      });

      const publication = await showcaseService.getPublication(
        params.storyId,
        params.publicationId,
      );
      if (!publication || publication.readerByteSize == null) {
        throw new AppError(404, 'Not found.');
      }

      const needsToken = entry.visibility === 'password' || includeNsfw;
      const access = needsToken
        ? await showcaseJwt.sign({
            storyId: params.storyId,
            ...(includeNsfw ? { nsfwOk: true as const } : {}),
            exp: Math.floor(Date.now() / 1000) + DOWNLOAD_URL_TTL_SECONDS,
          })
        : undefined;

      const base = `/api/public/stories/${params.storyId}/publications/${params.publicationId}/reader`;
      return { url: access ? `${base}?access=${encodeURIComponent(access)}` : base };
    },
    {
      params: t.Object({ storyId: t.String(), publicationId: t.String() }),
      response: t.Object({ url: t.String() }),
      detail: {
        summary: 'Get the address of the online reader of a published version',
        description:
          'For a password-protected story, the address carries a 60-second token, because a frame cannot send an Authorization header.',
        tags: ['Showcase'],
      },
    },
  );
