import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { env } from './config/env';
import { adminRoutes } from './modules/admin/admin.route';
import { authRoutes } from './modules/auth/auth.route';
import { friendRoutes } from './modules/friend/friend.route';
import { mediaRoutes } from './modules/media/media.route';
import { publicRoutes } from './modules/public/public.route';
import { publicationRoutes } from './modules/story/publication.route';
import { storyRoutes } from './modules/story/story.route';
import { storyPermissionRoutes } from './modules/storyPermission/storyPermission.route';
import { syncRoute } from './modules/sync/sync.route';
import { userRoutes } from './modules/user/user.route';
import { wsRoutes } from './modules/webSocket/webSocket.route';

/**
 * Contrato HTTP do Keres. A interface hospedada ocupa a origem (`/`, `/admin`,
 * `/showcase`); toda rota programática, inclusive WebSocket e documentação, vive aqui.
 */
export const API_PREFIX = '/api';

/** Rotas que desapareceram da raiz na migração para `/api`; nunca podem cair no SPA fallback. */
export const LEGACY_API_PATH_PREFIXES = [
  '/auth',
  '/sync',
  '/stories',
  '/media',
  '/story-permissions',
  '/friend',
  '/user',
  '/ws',
  '/public',
  '/swagger',
  '/kerescheck',
  '/admin/api',
];

export function isApiOrLegacyApiPath(pathname: string): boolean {
  return [API_PREFIX, ...LEGACY_API_PATH_PREFIXES].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

const scalarCss = `
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
`;

/** Monta a API abaixo de `/api`; o app principal apenas hospeda as UIs estáticas. */
export function createApiRoutes() {
  return new Elysia({ prefix: API_PREFIX })
    .use(
      swagger({
        path: '/swagger',
        provider: 'scalar',
        scalarConfig: { theme: 'none', customCss: scalarCss },
        documentation: {
          info: { title: 'Keres API Documentation', version: '1.0.0' },
          components: {
            securitySchemes: {
              bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
          },
          security: [{ bearerAuth: [] }],
        },
      }),
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
    .group('/admin', (app) => app.use(adminRoutes))
    .group('/auth', (app) => app.use(authRoutes))
    .group('/sync', (app) => app.use(syncRoute))
    .group('/stories', (app) => app.use(storyRoutes).use(publicationRoutes))
    .group('/media', (app) => app.use(mediaRoutes))
    .group('/story-permissions', (app) => app.use(storyPermissionRoutes))
    .group('/friend', (app) => app.use(friendRoutes))
    .group('/user', (app) => app.use(userRoutes))
    .group('/ws', (app) => app.use(wsRoutes))
    .group('/public', (app) => app.use(publicRoutes));
}
