import { Elysia, t } from 'elysia';
import { APP_RELEASE } from '@keres/shared';
import { jwtShowcase } from '../../config/jwt';
import { publicationStorageService } from '../../services/PublicationStorageService';
import { packService } from '../../services/PackService';
import { showcaseService } from '../../services/ShowcaseService';
import { showcaseSettingsService } from '../../services/ShowcaseSettingsService';
import { AppError } from '../../utils/errors';
import { createAttemptLimiter } from '../../utils/rateLimiter';

/**
 * The public site. No route here requires authentication, and none of them returns anything a
 * story's owner has not chosen to publish.
 *
 * With the Showcase off (the default), everything here answers 404 - not 403: a server that does not
 * want a public face also does not need to announce that the feature exists.
 */

/** The same window as /login: 5 attempts per 15 minutes, per story and per IP. */
const unlockLimiter = createAttemptLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });

/** Lifetime of the signed download URL. Short: it leaks into browser history and proxy logs. */
const DOWNLOAD_URL_TTL_SECONDS = 60;

/** A single message for "does not exist" and "wrong password" - see the comment on `/unlock`. */
const UNLOCK_FAILURE = 'Incorrect password.';

function slugify(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'story'
  );
}

const OwnerSchema = t.Object({
  username: t.String(),
  tag: t.String(),
  avatarColor: t.Nullable(t.String()),
  avatarIcon: t.Nullable(t.String()),
});

const SnapshotSchema = t.Object({
  title: t.String(),
  description: t.Nullable(t.String()),
  genre: t.Nullable(t.String()),
  language: t.Nullable(t.String()),
  author: t.Nullable(t.String()),
  type: t.String(),
  theme: t.Nullable(t.String()),
});

const VersionSchema = t.Object({
  id: t.String(),
  label: t.String(),
  byteSize: t.Number(),
  mediaIncluded: t.Number(),
  mediaTotal: t.Number(),
  createdAt: t.String(),
});

export const publicRoutes = new Elysia()
  .use(jwtShowcase)
  .get(
    '/config',
    async () => ({
      showcaseEnabled: await showcaseSettingsService.isEnabled(),
      serverVersion: APP_RELEASE.version,
    }),
    {
      response: t.Object({ showcaseEnabled: t.Boolean(), serverVersion: t.String() }),
      detail: {
        summary: 'Showcase availability',
        description:
          'Whether this server exposes a public showcase. The only route here that answers while it is disabled.',
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
        '/stories',
        async ({ set, headers }) => {
          const etag = await showcaseService.listEtag();
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
          // O site consulta em intervalo; sem isto cada visita repetida baixaria a lista inteira.
          set.headers['cache-control'] = cacheControl;
          return showcaseService.listPublicStories();
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
        async ({ params, set }) => {
          const pack = await packService.getPublicById(params.packId);
          if (!pack) {
            // A private pack answers 404 rather than 403: it is not on offer here, and saying
            // "forbidden" would confirm it exists.
            set.status = 404;
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
        async ({ params, headers, jwtShowcase: showcaseJwt, set }) => {
          const entry = await showcaseService.getEntry(params.storyId);
          if (!entry) {
            set.status = 404;
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

          const detail = await showcaseService.getStoryDetail(params.storyId);
          if (!detail) {
            set.status = 404;
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
        async ({ params, body, jwtShowcase: showcaseJwt, server, request, set }) => {
          const clientIp = server?.requestIP(request)?.address ?? 'unknown';
          if (!unlockLimiter.registerAttempt(`${params.storyId}:${clientIp}`)) {
            set.status = 429;
            return { message: 'Too many attempts. Try again later.' };
          }

          // A single answer for "the story does not exist" and "wrong password". Telling them apart would turn
          // this endpoint into an existence oracle, undoing the silence GET /stories/:storyId deliberately
          // keeps.
          if (!(await showcaseService.verifyPassword(params.storyId, body.password))) {
            set.status = 401;
            return { message: UNLOCK_FAILURE };
          }

          unlockLimiter.clearAttempts(`${params.storyId}:${clientIp}`);
          return { token: await showcaseJwt.sign({ storyId: params.storyId }) };
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
        async ({ params, headers, query, jwtShowcase: showcaseJwt, set }) => {
          const entry = await showcaseService.getEntry(params.storyId);
          if (!entry) {
            set.status = 404;
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
              set.status = 404;
              throw new AppError(404, 'Not found.');
            }
          }

          const publication = await showcaseService.getPublication(
            params.storyId,
            params.publicationId,
          );
          if (!publication) {
            set.status = 404;
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
            set.status = 404;
            throw new AppError(404, 'Not found.');
          }

          set.headers['content-type'] = 'application/zip';
          set.headers['content-disposition'] = `attachment; filename="${fileName}"`;
          // A publication never changes after it is created.
          set.headers['cache-control'] = 'public, max-age=31536000, immutable';
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
        async ({ params, headers, jwtShowcase: showcaseJwt, set }) => {
          const entry = await showcaseService.getEntry(params.storyId);
          if (!entry) {
            set.status = 404;
            throw new AppError(404, 'Not found.');
          }
          if (
            entry.visibility === 'password' &&
            !(await verifyShowcaseToken(showcaseJwt, headers['authorization'], params.storyId))
          ) {
            set.status = 404;
            throw new AppError(404, 'Not found.');
          }

          const publication = await showcaseService.getPublication(
            params.storyId,
            params.publicationId,
          );
          if (!publication) {
            set.status = 404;
            throw new AppError(404, 'Not found.');
          }

          const access =
            entry.visibility === 'password'
              ? await showcaseJwt.sign({
                  storyId: params.storyId,
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
      ),
  );

/**
 * Checks an `Authorization: Showcase <token>` and returns whether it unlocks *this* story.
 *
 * The scope is per story on purpose: holding one story's password does not make another visible.
 */
async function verifyShowcaseToken(
  showcaseJwt: { verify: (token: string) => Promise<{ storyId?: string } | false> },
  authorization: string | undefined,
  storyId: string,
): Promise<boolean> {
  if (!authorization?.startsWith('Showcase ')) {
    return false;
  }
  const payload = await showcaseJwt.verify(authorization.slice('Showcase '.length));
  return !!payload && payload.storyId === storyId;
}
