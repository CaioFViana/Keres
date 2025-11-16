import { bearer } from '@elysiajs/bearer';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import { swagger } from '@elysiajs/swagger';
import { Elysia, t } from 'elysia';
import { env } from './config/env';
import { authRoutes } from './modules/auth/auth.route';
import { storyRoutes } from './modules/story/story.route';
import { storyPermissionRoutes } from './modules/storyPermission/storyPermission.route'; // Import the new route
import { syncRoute } from './modules/sync/sync.route';

// Define a placeholder type for the JWT payload
// In a real application, this would be derived from your User entity
export interface JWTPayload { // Export JWTPayload
  userId: string;
  username: string;
}

const app = new Elysia()
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
  )
  .derive(async ({ jwt, headers, set }) => {
    const authHeader = headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
  .group('/auth', (app) => app.use(authRoutes))
  .group('/sync', (app) => app.use(syncRoute))
  .group('/stories', (app) => app.use(storyRoutes))
  .group('/story-permissions', (app) => app.use(storyPermissionRoutes))
  .listen(env.PORT, ({ hostname, port }) => {
    console.log(`🦊 Elysia is running at http://${hostname}:${port}`);
    console.log(`📖 Swagger UI at http://${hostname}:${port}/swagger`);
  });

export type App = typeof app;