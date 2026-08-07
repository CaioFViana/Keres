import { bearer } from '@elysiajs/bearer';
import { cookie } from '@elysiajs/cookie';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { staticPlugin } from '@elysiajs/static';
import { swagger } from '@elysiajs/swagger';
import { Elysia, t } from 'elysia';
import { existsSync } from 'fs';
import * as path from 'path';
import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { adminRoutes } from './modules/admin/admin.route';
import { authRoutes } from './modules/auth/auth.route';
import { friendRoutes } from './modules/friend/friend.route';
import { mediaRoutes } from './modules/media/media.route';
import { storyRoutes } from './modules/story/story.route';
import { storyPermissionRoutes } from './modules/storyPermission/storyPermission.route';
import { syncRoute } from './modules/sync/sync.route';
import { userRoutes } from './modules/user/user.route'; // Import userRoutes
import { wsRoutes } from './modules/webSocket/webSocket.route';
import { reconcileRootAdmin } from './services/RootAdminService';
import { AppError } from './utils/errors';
import { logger } from './utils/logger';

// Precisa rodar antes de tudo: um banco novo não tem nenhuma tabela, e a própria consulta de
// reconcileRootAdmin logo abaixo já falharia sem isto.
await runMigrations();

// Roda antes de qualquer coisa aceitar tráfego: garante que a conta admin "root"
// configurada via env exista e esteja com isAdmin=true antes que qualquer login seja
// possível (ver RootAdminService.ts para o porquê disso substituir um script de bootstrap).
await reconcileRootAdmin();

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
 * Resolvido a partir de `import.meta.dir` (não `process.cwd()`): precisa continuar
 * encontrando `apps/admin/dist` não importa de onde o processo foi iniciado (ex: dentro do
 * container Docker o WORKDIR final é `apps/api`, mas nada garante isso em todo cenário).
 */
const adminDistPath = path.join(import.meta.dir, '..', '..', 'admin', 'dist');
const adminDistIndexPath = path.join(adminDistPath, 'index.html');
const adminUiAvailable = existsSync(adminDistIndexPath);

if (!adminUiAvailable) {
  logger.warn(`Admin UI not built - /admin will 404. Run 'bun run build' in apps/api (or apps/admin) to enable it.`);
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

function isDatabaseConnectivityError(error: unknown): boolean {
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

export const elysiaApp = new Elysia() // Export app as elysiaApp
  .use(
    swagger({
      path: '/swagger',
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
  .use(bearer())
  .use(
    jwt({
      name: 'jwt',
      secret: env.JWT_SECRET,
      exp: '1h', // Access token expiration
      schema: t.Object({ // Define schema for JWT payload
        userId: t.String(),
        username: t.String(),
      })
    }),
  ).use(cors())
  .derive(async ({ jwt, headers, set, cookie }) => {
    let token: string | null | undefined = headers['authorization']?.startsWith('Bearer ') ? headers['authorization'].slice(7) : null;

    if (!token && typeof cookie['access_token'].value === 'string') {
      token = cookie['access_token'].value;
    }

    if (!token) {
      // If no token, user is not authenticated.
      // We don't throw an error here, but rather return null for the user,
      // allowing routes to decide if authentication is mandatory.
      return { user: null };
    }

    try {
      const payload = await jwt.verify(token);
      if (!payload) {
        set.status = 401;
        throw new Error('Invalid token');
      }
      // In a real application, you would fetch user details from the database
      // and return a more complete user object. For now, just return the payload.
      return { user: payload as JWTPayload }; // Cast to our defined payload type
    } catch (error) {
      set.status = 401;
      throw new Error('Invalid token');
    }
  })
  .onError(({ code, error, set, path, request }) => {
    const err = error instanceof Error ? error : new Error(String(error));
    const label = `${request.method} ${path}`;

    // A route that deliberately rejected with AppError (any status, including 500)
    // already chose a safe, user-facing message - relay it as-is.
    if (err instanceof AppError) {
      set.status = err.status;
      logger.warn(`Rejected request: ${label}`, { status: err.status, message: err.message });
      return { message: err.message };
    }

    // Route handlers that deliberately picked a non-500 status before throwing a plain
    // Error (401/403/404/409...) already chose a safe message too - relay it as-is.
    // 500 is excluded here because Elysia defaults untouched status to 500 for any
    // unclassified thrown error, so it can't tell "the app chose 500" from "nothing did".
    if (typeof set.status === 'number' && set.status !== 500) {
      logger.warn(`Rejected request: ${label}`, { status: set.status, message: err.message });
      return { message: err.message };
    }

    if (isDatabaseConnectivityError(err)) {
      set.status = 503;
      logger.error(`Database unreachable while handling ${label}`, err, { code });
      return { message: 'Service temporarily unavailable. Please try again shortly.' };
    }

    // Anything else is unexpected - never leak internals (SQL, stack traces) to the client.
    set.status = 500;
    logger.error(`Unhandled error while handling ${label}`, err, { code });
    return { message: 'Internal server error.' };
  })
  .get('/', ({ redirect }) => {
    redirect('/swagger')
  }, {
    detail: {
      summary: 'Redirect to Swagger UI',
      description: 'Redirects the user to the API documentation provided by Swagger UI.',
      tags: ['Documentation'],
    },
  })
  .get('/kerescheck', ({ set }) => {
    set.status = 200;
    return { version: env.SERVER_VERSION };
  }, {
    detail: {
      summary: 'Check API Status',
      description: 'Returns the current version of the Keres API, useful for health checks.',
      tags: ['Health Check'],
    },
  })
  .group('/admin/api', (app) => app.use(adminRoutes))
  .use(adminUiAvailable ? await staticPlugin({ assets: adminDistPath, prefix: '/admin', alwaysStatic: true }) : new Elysia())
  .get('/admin/*', ({ set }) => {
    if (!adminUiAvailable) {
      set.status = 404;
      return { message: "Admin UI not built. Run 'bun run build' in apps/api first." };
    }
    // Fallback de SPA: qualquer rota do painel que não seja um arquivo estático real (ex:
    // /admin/users, uma rota de cliente do React Router) recebe o mesmo index.html, que
    // então resolve a rota no navegador. Sem isto, um F5 em /admin/users daria 404.
    return Bun.file(adminDistIndexPath);
  }, {
    detail: {
      summary: 'Admin panel (single-page app)',
      description: 'Serves the built apps/admin SPA and its client-side routes.',
      tags: ['Admin'],
    },
  })
  .group('/auth', (app) => app.use(authRoutes))
  .group('/sync', (app) => app.use(syncRoute))
  .group('/stories', (app) => app.use(storyRoutes))
  .group('/media', (app) => app.use(mediaRoutes))
  .group('/story-permissions', (app) => app.use(storyPermissionRoutes))
  .group('/friend', (app) => app.use(friendRoutes))
  .group('/user', (app) => app.use(userRoutes)) // Add userRoutes
  .group('/ws', (app) => app.use(wsRoutes))
  .listen(env.PORT, ({ hostname, port }) => { // Corrected parameters
    logger.info(`Elysia is running at http://${hostname}:${port}`);
    logger.info(`Swagger UI at http://${hostname}:${port}/swagger`);
    if (adminUiAvailable) {
      logger.info(`Admin panel at http://${hostname}:${port}/admin`);
    }
  });