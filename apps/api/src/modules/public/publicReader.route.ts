import { t, Elysia } from 'elysia';
import { jwtShowcase } from '../../config/jwt';
import { publicationStorageService } from '../../services/PublicationStorageService';
import { showcaseService } from '../../services/ShowcaseService';
import { showcaseSettingsService } from '../../services/ShowcaseSettingsService';
import { AppError } from '../../utils/errors';
import { DOWNLOAD_URL_TTL_SECONDS, verifyShowcaseToken } from './showcaseAccess';

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
  .use(jwtShowcase)
  // Like everything else public but the config, these only exist with the Showcase on.
  .onBeforeHandle(async () => {
    if (!(await showcaseSettingsService.isEnabled())) {
      throw new AppError(404, 'Not found.');
    }
  })
  .get(
    '/stories/:storyId/publications/:publicationId/reader',
    async ({ params, headers, query, jwtShowcase: showcaseJwt, set }) => {
      const entry = await showcaseService.getEntry(params.storyId);
      if (!entry) {
        throw new AppError(404, 'Not found.');
      }
      if (entry.visibility === 'password') {
        // The reader loads in a frame, which carries no Authorization header either.
        const authorized =
          (await verifyShowcaseToken(showcaseJwt, headers['authorization'], params.storyId)) ||
          (await verifyShowcaseToken(
            showcaseJwt,
            query.access ? `Showcase ${query.access}` : undefined,
            params.storyId,
          ));
        if (!authorized) {
          throw new AppError(404, 'Not found.');
        }
      }

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
      // for a shared cache, and its address carries a token.
      set.headers['cache-control'] =
        entry.visibility === 'password'
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
    async ({ params, headers, jwtShowcase: showcaseJwt }) => {
      const entry = await showcaseService.getEntry(params.storyId);
      if (!entry) {
        throw new AppError(404, 'Not found.');
      }
      if (
        entry.visibility === 'password' &&
        !(await verifyShowcaseToken(showcaseJwt, headers['authorization'], params.storyId))
      ) {
        throw new AppError(404, 'Not found.');
      }

      const publication = await showcaseService.getPublication(
        params.storyId,
        params.publicationId,
      );
      if (!publication || publication.readerByteSize == null) {
        throw new AppError(404, 'Not found.');
      }

      const access =
        entry.visibility === 'password'
          ? await showcaseJwt.sign({
              storyId: params.storyId,
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
