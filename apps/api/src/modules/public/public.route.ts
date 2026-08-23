import { Elysia, t } from 'elysia';
import { env } from '../../config/env';
import { jwtShowcase } from '../../config/jwt';
import { publicationStorageService } from '../../services/PublicationStorageService';
import { showcaseService } from '../../services/ShowcaseService';
import { showcaseSettingsService } from '../../services/ShowcaseSettingsService';
import { AppError } from '../../utils/errors';
import { createAttemptLimiter } from '../../utils/rateLimiter';

/**
 * O site público. Nenhuma rota daqui exige autenticação, e nenhuma delas devolve algo que o
 * dono de uma história não tenha escolhido publicar.
 *
 * Com o Showcase desligado (o padrão), tudo aqui responde 404 - não 403: um servidor que não
 * quer ter cara pública também não precisa anunciar que a funcionalidade existe.
 */

/** Mesma janela do /login: 5 tentativas por 15 minutos, por história e por IP. */
const unlockLimiter = createAttemptLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });

/** Vida da URL assinada de download. Curta: ela vaza em histórico de navegador e log de proxy. */
const DOWNLOAD_URL_TTL_SECONDS = 60;

/** Mensagem única para "não existe" e "senha errada" - ver o comentário em `/unlock`. */
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
      serverVersion: env.SERVER_VERSION,
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
  // Todo o resto só existe com o Showcase ligado.
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
            // `Response` direto: um 304 não pode ter corpo, e devolver um valor daqui faria o
            // Elysia montar uma resposta com corpo por cima desse status.
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
              // Só isto. Nem título, nem autor, nem quantas versões existem: um link vazado não
              // pode ser interessante por si só, e o 200 aqui não confirma nada que o próprio
              // ULID no endereço já não dissesse.
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

          // Uma resposta só para "história não existe" e "senha errada". Distinguir as duas
          // transformaria este endpoint num oráculo de existência, desfazendo o silêncio que
          // GET /stories/:storyId mantém de propósito.
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
            // Um `<a download>` não carrega header, então a página pede o link em
            // `POST .../download-url` e recebe o token de volta como parâmetro, com validade
            // de 60 segundos. É o único lugar onde ele aparece numa URL.
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

          // Em S3, redirecionar em vez de repassar os bytes: é justamente para o processo da
          // API não virar o gargalo de banda de uma história popular que o armazenamento
          // remoto existe. No disco local não há URL para assinar, então servimos normalmente.
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
          // Uma publicação nunca muda depois de criada.
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
 * Confere um `Authorization: Showcase <token>` e devolve se ele abre *esta* história.
 *
 * O escopo é por história de propósito: quem tem a senha de uma não passa a enxergar outra.
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
