import { cookie } from '@elysiajs/cookie';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { staticPlugin } from '@elysiajs/static';
import { swagger } from '@elysiajs/swagger';
import { Elysia, t } from 'elysia';
import { existsSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env';
import { adminRoutes } from './modules/admin/admin.route';
import { authRoutes } from './modules/auth/auth.route';
import { friendRoutes } from './modules/friend/friend.route';
import { mediaRoutes } from './modules/media/media.route';
import { storyRoutes } from './modules/story/story.route';
import { storyPermissionRoutes } from './modules/storyPermission/storyPermission.route';
import { syncRoute } from './modules/sync/sync.route';
import { userRoutes } from './modules/user/user.route'; // Import userRoutes
import { wsRoutes } from './modules/webSocket/webSocket.route';
import { AppError } from './utils/errors';
import { logger } from './utils/logger';

/**
 * Co-hospedagem do painel admin: subir a API já serve o app web junto, no mesmo
 * processo/porta, sem precisar de um segundo deploy. `apps/admin` continua sendo buildado
 * separadamente (`bun run build`, que roda `vite build` - ver apps/admin/package.json); o
 * que muda aqui é só servir o resultado estático.
 *
 * O prefixo do app é `/admin` (arquivos estáticos + fallback de SPA abaixo); a API JSON
 * usada por ele mora em `/admin/api/*`, para as duas coisas não brigarem pelo mesmo espaço
 * de URL. Se o build ainda não existir (dev sem `bun run build`, ou API rodando sozinha),
 * isso não derruba o servidor - só o painel fica indisponível, a API continua normal.
 *
 * Resolvido a partir do próprio módulo (não `process.cwd()`): precisa continuar
 * encontrando `apps/admin/dist` não importa de onde o processo foi iniciado (ex: dentro do
 * container Docker o WORKDIR final é `apps/api`, mas nada garante isso em todo cenário).
 */
const apiSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const adminDistPath = path.join(apiSourceDirectory, '..', '..', 'admin', 'dist');
const adminDistIndexPath = path.join(adminDistPath, 'index.html');
const adminUiAvailable = existsSync(adminDistIndexPath);

/** Headers for the co-hosted admin SPA (static assets + HTML fallback). Not applied to `/admin/api/*`. */
const ADMIN_UI_SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

function applyAdminUiSecurityHeaders(set: { headers: Record<string, string | number> }): void {
  for (const [name, value] of Object.entries(ADMIN_UI_SECURITY_HEADERS)) {
    set.headers[name] = value;
  }
}

if (!adminUiAvailable) {
  logger.warn(
    `Admin UI not built - /admin will 404. Run 'bun run build' in apps/api (or apps/admin) to enable it.`,
  );
}

/** pg/network error codes that mean "couldn't reach or lost the database", not an app bug. */
const DB_CONNECTIVITY_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
  '57P03', // Postgres: cannot_connect_now
]);

export function isDatabaseConnectivityError(error: unknown): boolean {
  let current: unknown = error;
  // drizzle/pg wrap the root network error in `.cause`, sometimes more than one layer deep.
  for (let depth = 0; current && depth < 5; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && DB_CONNECTIVITY_ERROR_CODES.has(code)) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

// Define a placeholder type for the JWT payload
// In a real application, this would be derived from your User entity
export interface JWTPayload {
  userId: string;
  username: string;
}

/** Cria a aplicação sem migrar banco, reconciliar admin ou abrir uma porta. */
export async function createApp() {
  return new Elysia()
    .use(
      swagger({
        path: '/swagger',
        // Default provider (Scalar's API Reference) kept explicit since scalarConfig below is
        // specific to it - if this ever changes to 'swagger-ui', the theme needs redoing with
        // that provider's own CSS classes instead.
        provider: 'scalar',
        scalarConfig: {
          // 'none' instead of a built-in preset (e.g. 'purple'): a preset ships its own full
          // stylesheet that the overrides below would otherwise be fighting piece by piece.
          theme: 'none',
          // Same palette as apps/client/src/theme/palettes/default.ts, mapped onto Scalar's
          // own CSS custom properties (see https://github.com/scalar/scalar - documentation/
          // themes.md) so /swagger doesn't look like a default Scalar install next to the rest
          // of the app. `primaryContainer` (a primary-tinted surface in the client's Material-
          // style palette) is a clean semantic match for Scalar's "accent background" slot;
          // there's no third background/text tier in the client palette, so those reuse the
          // second tier rather than inventing a color that doesn't exist anywhere else.
          customCss: `
            .light-mode {
              --scalar-color-accent: #6200EE;
              --scalar-background-1: #FFFFFF;
              --scalar-background-2: #F5F5F5;
              --scalar-background-3: #F5F5F5;
              --scalar-background-accent: #EADDFF;
              --scalar-color-1: #000000;
              --scalar-color-2: #666666;
              --scalar-color-3: #666666;
              --scalar-border-color: #E0E0E0;
            }
            .dark-mode {
              --scalar-color-accent: #BB86FC;
              --scalar-background-1: #121212;
              --scalar-background-2: #1E1E1E;
              --scalar-background-3: #1E1E1E;
              --scalar-background-accent: #4F378B;
              --scalar-color-1: #FFFFFF;
              --scalar-color-2: #AAAAAA;
              --scalar-color-3: #AAAAAA;
              --scalar-border-color: #333333;
            }
          `,
        },
        documentation: {
          info: {
            title: 'Keres API Documentation',
            version: '1.0.0',
          },
          components: {
            securitySchemes: {
              bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
              },
            },
          },
          security: [
            {
              bearerAuth: [],
            },
          ],
        },
      }),
    )
    .use(cookie())
    .use(
      jwt({
        name: 'jwt',
        secret: env.JWT_SECRET,
        exp: '1h', // Access token expiration
        schema: t.Object({
          // Define schema for JWT payload
          userId: t.String(),
          username: t.String(),
        }),
      }),
    )
    .use(
      cors({
        // No client (mobile, desktop, web export, admin panel) authenticates via cookies -
        // every one of them attaches `Authorization: Bearer <token>` itself (see apiClient.ts
        // on the client and admin sides), so nothing actually needs the browser to send
        // cookies cross-origin. The default `credentials: true` combined with the default
        // `origin: true` (reflects any request Origin back) let any third-party site make
        // credentialed requests using this app's httpOnly auth cookies and read the response.
        // Disabling credentials here closes that off while keeping `origin: true`, which this
        // self-hosted, multi-deployment app still needs (there's no fixed set of client
        // origins to allowlist - every self-hoster's install is its own origin).
        credentials: false,
      }),
    )
    .derive(async ({ jwt, headers, cookie }) => {
      let token: string | null | undefined = headers['authorization']?.startsWith('Bearer ')
        ? headers['authorization'].slice(7)
        : null;

      if (!token && typeof cookie['access_token'].value === 'string') {
        token = cookie['access_token'].value;
      }

      if (!token) {
        // If no token, user is not authenticated.
        // We don't throw an error here, but rather return null for the user,
        // allowing routes to decide if authentication is mandatory.
        return { user: null };
      }

      // An invalid/expired token is treated exactly like no token at all - this `.derive()`
      // runs on every request, including public ones (GET /kerescheck, GET /swagger, POST
      // /auth/login...). Throwing 401 here used to reject those too, just because a client
      // happened to carry a stale token; each route that actually requires auth already does
      // its own `if (!user) { 401 }` check right after this runs, so nothing is lost by
      // deferring the rejection to there instead.
      try {
        const payload = await jwt.verify(token);
        return { user: (payload || null) as JWTPayload | null };
      } catch {
        return { user: null };
      }
    })
    .onError(({ code, error, set, path, request, user, params }) => {
      const err = error instanceof Error ? error : new Error(String(error));
      const label = `${request.method} ${path}`;
      const userId = (user as JWTPayload | null)?.userId ?? null;
      // Só rotas com um :storyId nos params carregam isto - não força o campo quando não é
      // significativo (ex: nem toda rota é escopada a uma história).
      const storyId = (params as { storyId?: string } | undefined)?.storyId ?? null;

      // A route that deliberately rejected with AppError (any status, including 500)
      // already chose a safe, user-facing message - relay it as-is.
      if (err instanceof AppError) {
        set.status = err.status;
        logger.warn(`Rejected request: ${label}`, {
          status: err.status,
          message: err.message,
          userId,
          storyId,
        });
        return { message: err.message };
      }

      // Route handlers that deliberately picked a non-500 status before throwing a plain
      // Error (401/403/404/409...) already chose a safe message too - relay it as-is.
      // 500 is excluded here because Elysia defaults untouched status to 500 for any
      // unclassified thrown error, so it can't tell "the app chose 500" from "nothing did".
      if (typeof set.status === 'number' && set.status !== 500) {
        logger.warn(`Rejected request: ${label}`, {
          status: set.status,
          message: err.message,
          userId,
          storyId,
        });
        return { message: err.message };
      }

      if (isDatabaseConnectivityError(err)) {
        set.status = 503;
        logger.error(`Database unreachable while handling ${label}`, err, {
          code,
          userId,
          storyId,
        });
        return { message: 'Service temporarily unavailable. Please try again shortly.' };
      }

      // Anything else is unexpected - never leak internals (SQL, stack traces) to the client.
      set.status = 500;
      logger.error(`Unhandled error while handling ${label}`, err, { code, userId, storyId });
      return { message: 'Internal server error.' };
    })
    .get(
      '/',
      ({ redirect }) => {
        redirect('/swagger');
      },
      {
        detail: {
          summary: 'Redirect to Swagger UI',
          description: 'Redirects the user to the API documentation provided by Swagger UI.',
          tags: ['Documentation'],
        },
      },
    )
    .get(
      '/kerescheck',
      ({ set }) => {
        set.status = 200;
        return { version: env.SERVER_VERSION };
      },
      {
        detail: {
          summary: 'Check API Status',
          description: 'Returns the current version of the Keres API, useful for health checks.',
          tags: ['Health Check'],
        },
      },
    )
    .group('/admin/api', (app) => app.use(adminRoutes))
    .onAfterHandle(({ request, set }) => {
      const pathname = new URL(request.url).pathname;
      if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/api')) {
        applyAdminUiSecurityHeaders(set);
      }
    })
    .use(
      adminUiAvailable
        ? await staticPlugin({ assets: adminDistPath, prefix: '/admin', alwaysStatic: true })
        : new Elysia(),
    )
    .get(
      '/admin/*',
      ({ set }) => {
        if (!adminUiAvailable) {
          set.status = 404;
          return { message: "Admin UI not built. Run 'bun run build' in apps/api first." };
        }
        applyAdminUiSecurityHeaders(set);
        // Fallback de SPA: qualquer rota do painel que não seja um arquivo estático real (ex:
        // /admin/users, uma rota de cliente do React Router) recebe o mesmo index.html, que
        // então resolve a rota no navegador. Sem isto, um F5 em /admin/users daria 404.
        return Bun.file(adminDistIndexPath);
      },
      {
        detail: {
          summary: 'Admin panel (single-page app)',
          description: 'Serves the built apps/admin SPA and its client-side routes.',
          tags: ['Admin'],
        },
      },
    )
    .group('/auth', (app) => app.use(authRoutes))
    .group('/sync', (app) => app.use(syncRoute))
    .group('/stories', (app) => app.use(storyRoutes))
    .group('/media', (app) => app.use(mediaRoutes))
    .group('/story-permissions', (app) => app.use(storyPermissionRoutes))
    .group('/friend', (app) => app.use(friendRoutes))
    .group('/user', (app) => app.use(userRoutes)) // Add userRoutes
    .group('/ws', (app) => app.use(wsRoutes));
}
