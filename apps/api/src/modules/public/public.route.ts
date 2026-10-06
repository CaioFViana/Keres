import { APP_RELEASE } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { jwtShowcase } from '../../config/jwt';
import type { JWTPayload } from '../../index';
import { packService } from '../../services/PackService';
import { publicationStorageService } from '../../services/PublicationStorageService';
import { showcaseLogoStorageService } from '../../services/ShowcaseLogoStorageService';
import { showcaseService } from '../../services/ShowcaseService';
import { showcaseSettingsService } from '../../services/ShowcaseSettingsService';
import { AppError } from '../../utils/errors';
import { createAttemptLimiter } from '../../utils/rateLimiter';
import { publicReaderRoutes } from './publicReader.route';
import {
  manuscriptMetaOf,
  OwnerSchema,
  SnapshotSchema,
  slugify,
  VersionSchema,
} from './publicShapes';
import { DOWNLOAD_URL_TTL_SECONDS, verifyNsfwToken, verifyShowcaseToken } from './showcaseAccess';

/**
 * The public site. No route here requires authentication, and none of them returns anything a
 * story's owner has not chosen to publish.
 *
 * With the Showcase off (the default), everything here answers 404 - not 403: a server that does not
 * want a public face also does not need to announce that the feature exists. The landing page's
 * own calls (`/tiers`, `/contact`) live in `publicLanding.route.ts`, mounted next to this module
 * but outside its guard.
 */

/** The same window as /login: 5 attempts per 15 minutes, per story and per IP. */
const unlockLimiter = createAttemptLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });

/** A single message for "does not exist" and "wrong password" - see the comment on `/unlock`. */
const UNLOCK_FAILURE = 'Incorrect password.';

/**
 * Whether this request may see NSFW showcase content: a live age-verified session (resolved by
 * the global derive, from Bearer or cookie), or - for one story - a content token issued to such
 * a session. Anything else sees only the safe catalog. Never throws.
 */
async function maySeeNsfw(
  user: JWTPayload | null,
  showcaseJwt: {
    verify: (token: string) => Promise<{ storyId?: string; nsfwOk?: boolean } | false>;
  },
  authorization: string | undefined,
  storyId: string,
): Promise<boolean> {
  if (await showcaseService.viewerIncludesNsfw(user)) {
    return true;
  }
  return verifyNsfwToken(showcaseJwt, authorization, storyId);
}

export const publicRoutes = new Elysia()
  // The global derive already resolves the session (Bearer or cookie) into `user` for every
  // request - this only declares the field for TypeScript, like the other modules do. Public
  // routes decide per endpoint whether it matters; nothing here 401s on a missing session.
  .decorate('user', null as JWTPayload | null)
  .use(jwtShowcase)
  .get(
    '/config',
    async () => {
      const settings = await showcaseSettingsService.getOrCreate();
      return {
        showcaseEnabled: settings.isShowcaseEnabled,
        serverVersion: APP_RELEASE.version,
        siteName: settings.siteName,
        sitePalette: settings.sitePalette,
        logoUrl:
          settings.logoContentType && settings.logoUpdatedAt
            ? `/api/public/showcase-logo?v=${settings.logoUpdatedAt.getTime()}`
            : null,
      };
    },
    {
      response: t.Object({
        showcaseEnabled: t.Boolean(),
        serverVersion: t.String(),
        siteName: t.String(),
        sitePalette: t.String(),
        logoUrl: t.Nullable(t.String()),
      }),
      detail: {
        summary: 'Showcase availability',
        description:
          'Whether this server exposes a public showcase. The only route in this module that answers while it is disabled (the landing calls live in their own module).',
        tags: ['Showcase'],
      },
    },
  )
  // Everything else only exists with the Showcase on.
  .guard({}, (app) =>
    app
      .onBeforeHandle(async ({ path }) => {
        if (path === '/api/public/config') {
          return;
        }
        if (!(await showcaseSettingsService.isEnabled())) {
          throw new AppError(404, 'Not found.');
        }
      })
      .get(
        '/showcase-logo',
        async ({ set, headers }) => {
          const settings = await showcaseSettingsService.getOrCreate();
          if (!settings.logoContentType || !settings.logoUpdatedAt) {
            throw new AppError(404, 'Not found.');
          }
          const body = await showcaseLogoStorageService.read();
          if (!body) {
            throw new AppError(404, 'Not found.');
          }
          // The `?v=` on the config URL changes on every upload, so an hour of caching is safe.
          const etag = `W/"showcase-logo-${settings.logoUpdatedAt.getTime()}"`;
          const cacheControl = 'public, max-age=3600';
          if (headers['if-none-match'] === etag) {
            return new Response(null, {
              status: 304,
              headers: { etag, 'cache-control': cacheControl },
            });
          }
          set.headers['content-type'] = settings.logoContentType;
          set.headers['etag'] = etag;
          set.headers['cache-control'] = cacheControl;
          return body;
        },
        {
          detail: {
            summary: 'The public site logo',
            description:
              'Serves the logo uploaded by the administrator. 404s while the showcase is disabled or no logo was uploaded.',
            tags: ['Showcase'],
          },
        },
      )
      .get(
        '/stories',
        async ({ set, headers, user }) => {
          const includeNsfw = await showcaseService.viewerIncludesNsfw(user);
          const etag = await showcaseService.listEtag(includeNsfw);
          const cacheControl = 'public, max-age=0, must-revalidate';
          if (headers['if-none-match'] === etag) {
            // A raw `Response`: a 304 cannot have a body, and returning a value from here would make Elysia
            // build a response with a body on top of that status.
            return new Response(null, {
              status: 304,
              headers: { etag, 'cache-control': cacheControl },
            });
          }
          set.headers['etag'] = etag;
          // The site polls on an interval; without this every repeated visit would download the whole list.
          set.headers['cache-control'] = cacheControl;
          // The list of one viewer class never validates another's cache: the etag carries the
          // class, and a forged etag only earns a refetch of what the forger may already see.
          set.headers['vary'] = 'Authorization';
          return showcaseService.listPublicStories(includeNsfw);
        },
        {
          detail: {
            summary: 'List the public stories',
            description:
              'Password-protected stories are never included. Supports If-None-Match so the page can poll cheaply.',
            tags: ['Showcase'],
          },
        },
      )
      .get('/packs', async () => packService.listPublic(), {
        detail: {
          summary: 'List the public packs',
          description:
            'Packs whose author flagged them public. One shared with the server but left private is never included, the same rule the story listing follows.',
          tags: ['Showcase'],
        },
      })
      .get(
        '/packs/:packId',
        async ({ params }) => {
          const pack = await packService.getPublicById(params.packId);
          if (!pack) {
            // A private pack answers 404 rather than 403: it is not on offer here, and saying
            // "forbidden" would confirm it exists.
            throw new AppError(404, 'Not found.');
          }
          return pack;
        },
        {
          params: t.Object({ packId: t.String() }),
          detail: {
            summary: 'Download a public pack',
            description: 'Returns the pack whole. No account is needed.',
            tags: ['Showcase'],
          },
        },
      )
      .get(
        '/stories/:storyId',
        async ({ params, headers, jwtShowcase: showcaseJwt, user }) => {
          const entry = await showcaseService.getEntry(params.storyId);
          if (!entry) {
            throw new AppError(404, 'Not found.');
          }

          if (entry.visibility === 'password') {
            const unlocked = await verifyShowcaseToken(
              showcaseJwt,
              headers['authorization'],
              params.storyId,
            );
            if (!unlocked) {
              // Only this. No title, no author, no count of versions: a leaked link must not be interesting on its
              // own, and the 200 here confirms nothing the ULID in the address did not already say.
              return { storyId: params.storyId, protected: true as const };
            }
          }

          // Shadowbanned (deactivated owner/story) and NSFW-to-unverified answer like
          // unpublished: 404, indistinguishable from a story that was never there.
          const includeNsfw = await maySeeNsfw(
            user,
            showcaseJwt,
            headers['authorization'],
            params.storyId,
          );
          const detail = await showcaseService.getStoryDetail(params.storyId, includeNsfw);
          if (!detail) {
            throw new AppError(404, 'Not found.');
          }
          return detail;
        },
        {
          params: t.Object({ storyId: t.String() }),
          response: t.Union([
            t.Object({ storyId: t.String(), protected: t.Literal(true) }),
            t.Object({
              storyId: t.String(),
              snapshot: SnapshotSchema,
              owner: OwnerSchema,
              versions: t.Array(VersionSchema),
              updatedAt: t.String(),
            }),
          ]),
          detail: {
            summary: 'A published story',
            description:
              'For a password-protected story without a valid unlock token, answers with a stub that carries no information about the story.',
            tags: ['Showcase'],
          },
        },
      )
      .post(
        '/stories/:storyId/unlock',
        async ({ params, body, jwtShowcase: showcaseJwt, server, request, user }) => {
          const clientIp = server?.requestIP(request)?.address ?? 'unknown';
          if (!unlockLimiter.registerAttempt(`${params.storyId}:${clientIp}`)) {
            throw new AppError(429, 'Too many attempts. Try again later.');
          }

          // A single answer for "the story does not exist" and "wrong password". Telling them apart would turn
          // this endpoint into an existence oracle, undoing the silence GET /stories/:storyId deliberately
          // keeps.
          if (!(await showcaseService.verifyPassword(params.storyId, body.password))) {
            throw new AppError(401, UNLOCK_FAILURE);
          }

          unlockLimiter.clearAttempts(`${params.storyId}:${clientIp}`);
          // A verified adult keeps their gating through header-less fetches: the token carries
          // the proof, so downloads and the reader of an NSFW+password story keep working.
          const nsfwOk = await showcaseService.viewerIncludesNsfw(user);
          return {
            token: await showcaseJwt.sign(
              nsfwOk ? { storyId: params.storyId, nsfwOk: true } : { storyId: params.storyId },
            ),
          };
        },
        {
          params: t.Object({ storyId: t.String() }),
          body: t.Object({ password: t.String({ minLength: 1, maxLength: 200 }) }),
          detail: {
            summary: 'Unlock a password-protected story',
            description:
              'Returns a token scoped to this one story, valid for one hour. The site sends it back as `Authorization: Showcase <token>`.',
            tags: ['Showcase'],
          },
        },
      )
      .get(
        '/stories/:storyId/publications/:publicationId/download',
        async ({ params, headers, query, jwtShowcase: showcaseJwt, set, user }) => {
          const entry = await showcaseService.getEntry(params.storyId);
          if (!entry) {
            throw new AppError(404, 'Not found.');
          }
          if (entry.visibility === 'password') {
            // An `<a download>` carries no header, so the page asks for the link at `POST .../download-url` and
            // gets the token back as a parameter, valid for 60 seconds. It is the only place where it appears in
            // a URL.
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
          // Shadowbanned and NSFW-to-unverified answer like unpublished. The session (header or
          // cookie) covers fetches; the `?access=` token covers header-less browser downloads.
          const includeNsfw =
            (await showcaseService.viewerIncludesNsfw(user)) ||
            (await verifyNsfwToken(showcaseJwt, headers['authorization'], params.storyId)) ||
            (await verifyNsfwToken(
              showcaseJwt,
              query.access ? `Showcase ${query.access}` : undefined,
              params.storyId,
            ));
          if (!(await showcaseService.isVisibleTo(params.storyId, includeNsfw))) {
            throw new AppError(404, 'Not found.');
          }

          const publication = await showcaseService.getPublication(
            params.storyId,
            params.publicationId,
          );
          // A version made only of a manuscript and/or the reader has no package to serve (nor, on S3,
          // a key to sign).
          if (!publication || !publication.packageIncluded) {
            throw new AppError(404, 'Not found.');
          }

          const fileName = `${slugify(
            (publication.snapshot as { title: string }).title,
          )}-${publication.label}.zip`;

          // On S3, redirect instead of relaying the bytes: keeping the API process from becoming a popular
          // story's bandwidth bottleneck is precisely why remote storage exists. On local disk there is no URL
          // to sign, so we serve it normally.
          const presigned = await publicationStorageService.presignedUrl(
            params.storyId,
            params.publicationId,
            DOWNLOAD_URL_TTL_SECONDS,
          );
          if (presigned) {
            set.status = 302;
            set.headers['location'] = presigned;
            return;
          }

          const body = await publicationStorageService.read(params.storyId, params.publicationId);
          if (!body) {
            throw new AppError(404, 'Not found.');
          }

          set.headers['content-type'] = 'application/zip';
          set.headers['content-disposition'] = `attachment; filename="${fileName}"`;
          // A publication never changes after it is created - but gated (NSFW) content is not
          // for a shared cache. Keyed on the story's flag, not the viewer class.
          set.headers['cache-control'] = (await showcaseService.isNsfwStory(params.storyId))
            ? 'private, max-age=31536000, immutable'
            : 'public, max-age=31536000, immutable';
          return body;
        },
        {
          params: t.Object({ storyId: t.String(), publicationId: t.String() }),
          query: t.Object({ access: t.Optional(t.String()) }),
          detail: {
            summary: 'Download a published version',
            description:
              'Serves the story package (story.json + media), byte-identical to a client export so it imports straight back into the app.',
            tags: ['Showcase'],
          },
        },
      )
      .post(
        '/stories/:storyId/publications/:publicationId/download-url',
        async ({ params, headers, jwtShowcase: showcaseJwt, user }) => {
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
          // The link is minted per viewer: shadowbanned and NSFW-to-unverified get no link at all.
          const includeNsfw = await maySeeNsfw(
            user,
            showcaseJwt,
            headers['authorization'],
            params.storyId,
          );
          if (!(await showcaseService.isVisibleTo(params.storyId, includeNsfw))) {
            throw new AppError(404, 'Not found.');
          }

          const publication = await showcaseService.getPublication(
            params.storyId,
            params.publicationId,
          );
          if (!publication || !publication.packageIncluded) {
            throw new AppError(404, 'Not found.');
          }

          // A token goes into the URL when the plain address would not open: password stories
          // (existing behavior), or a verified adult's NSFW download (the `nsfwOk` proof, so the
          // header-less download keeps the gating without carrying the session).
          const needsToken = entry.visibility === 'password' || includeNsfw;
          const access = needsToken
            ? await showcaseJwt.sign({
                storyId: params.storyId,
                ...(includeNsfw ? { nsfwOk: true as const } : {}),
                exp: Math.floor(Date.now() / 1000) + DOWNLOAD_URL_TTL_SECONDS,
              })
            : undefined;

          const base = `/api/public/stories/${params.storyId}/publications/${params.publicationId}/download`;
          return { url: access ? `${base}?access=${encodeURIComponent(access)}` : base };
        },
        {
          params: t.Object({ storyId: t.String(), publicationId: t.String() }),
          response: t.Object({ url: t.String() }),
          detail: {
            summary: 'Get a download link for a published version',
            description:
              'For a password-protected story, returns a link carrying a 60-second token, because a browser download cannot send an Authorization header.',
            tags: ['Showcase'],
          },
        },
      )
      .get(
        '/stories/:storyId/publications/:publicationId/manuscript/download',
        async ({ params, headers, query, jwtShowcase: showcaseJwt, set, user }) => {
          const entry = await showcaseService.getEntry(params.storyId);
          if (!entry) {
            throw new AppError(404, 'Not found.');
          }
          if (entry.visibility === 'password') {
            // Same arrangement as the package download: the token arrives as a query parameter
            // because `<a download>` carries no header.
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
          const includeNsfw =
            (await showcaseService.viewerIncludesNsfw(user)) ||
            (await verifyNsfwToken(showcaseJwt, headers['authorization'], params.storyId)) ||
            (await verifyNsfwToken(
              showcaseJwt,
              query.access ? `Showcase ${query.access}` : undefined,
              params.storyId,
            ));
          if (!(await showcaseService.isVisibleTo(params.storyId, includeNsfw))) {
            throw new AppError(404, 'Not found.');
          }

          const publication = await showcaseService.getPublication(
            params.storyId,
            params.publicationId,
          );
          // A version published without a manuscript answers like a version that was never
          // published: there is nothing to say beyond "not found".
          const meta = publication ? manuscriptMetaOf(publication) : null;
          if (!publication || !meta) {
            throw new AppError(404, 'Not found.');
          }

          const fileName = `${slugify(
            (publication.snapshot as { title: string }).title,
          )}-${publication.label}-manuscript.${meta.extension}`;

          const presigned = await publicationStorageService.presignedManuscriptUrl(
            params.storyId,
            params.publicationId,
            meta.extension,
            DOWNLOAD_URL_TTL_SECONDS,
          );
          if (presigned) {
            set.status = 302;
            set.headers['location'] = presigned;
            return;
          }

          const body = await publicationStorageService.readManuscript(
            params.storyId,
            params.publicationId,
            meta.extension,
          );
          if (!body) {
            throw new AppError(404, 'Not found.');
          }

          set.headers['content-type'] = meta.mimeType;
          set.headers['content-disposition'] = `attachment; filename="${fileName}"`;
          // A publication never changes after it is created - but gated (NSFW) content is not
          // for a shared cache. Keyed on the story's flag, not the viewer class.
          set.headers['cache-control'] = (await showcaseService.isNsfwStory(params.storyId))
            ? 'private, max-age=31536000, immutable'
            : 'public, max-age=31536000, immutable';
          return body;
        },
        {
          params: t.Object({ storyId: t.String(), publicationId: t.String() }),
          query: t.Object({ access: t.Optional(t.String()) }),
          detail: {
            summary: 'Download a published version manuscript',
            description:
              'Serves the readable manuscript published alongside the version, in the rendition the owner chose.',
            tags: ['Showcase'],
          },
        },
      )
      .post(
        '/stories/:storyId/publications/:publicationId/manuscript/download-url',
        async ({ params, headers, jwtShowcase: showcaseJwt, user }) => {
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
          const includeNsfw = await maySeeNsfw(
            user,
            showcaseJwt,
            headers['authorization'],
            params.storyId,
          );
          if (!(await showcaseService.isVisibleTo(params.storyId, includeNsfw))) {
            throw new AppError(404, 'Not found.');
          }

          const publication = await showcaseService.getPublication(
            params.storyId,
            params.publicationId,
          );
          if (!publication || !manuscriptMetaOf(publication)) {
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

          const base = `/api/public/stories/${params.storyId}/publications/${params.publicationId}/manuscript/download`;
          return { url: access ? `${base}?access=${encodeURIComponent(access)}` : base };
        },
        {
          params: t.Object({ storyId: t.String(), publicationId: t.String() }),
          response: t.Object({ url: t.String() }),
          detail: {
            summary: 'Get a download link for a published version manuscript',
            description:
              'For a password-protected story, returns a link carrying a 60-second token, because a browser download cannot send an Authorization header.',
            tags: ['Showcase'],
          },
        },
      ),
  )
  .use(publicReaderRoutes);
