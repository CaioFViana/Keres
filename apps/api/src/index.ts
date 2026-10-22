import { cookie } from '@elysiajs/cookie';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';
import { env } from './config/env';
import { createApiRoutes } from './api';
import { requestAudit } from './plugins/requestAudit';
import { assertPendingSessionMayReach } from './services/age-verification/pendingAccess';
import { AppError } from './utils/errors';
import { logger } from './utils/logger';
import { isDatabaseConnectivityError } from './utils/databaseConnectivity';
import { loadWebSurfaces, warnAboutMissingSurfaces } from './web/webSurfaces';
import { webEntryRoutes, webPageRoutes } from './web/webRoutes';
import type { JWTPayload } from './types/jwtPayload';

/**
 * The web bundles the API hands out beside its JSON routes - the admin panel, the showcase, the hosted
 * client and the landing page - in the same process and port, with no second deploy. Each is the build
 * output of another app (see `WEB_BUNDLES`); one that was never built only takes its own surface down.
 */
const surfaces = loadWebSurfaces();
warnAboutMissingSurfaces(surfaces);

export { isDatabaseConnectivityError };

export type { JWTPayload };

/** Creates the application without migrating the database, reconciling the admin or opening a port. */
export async function createApp() {
  return (
    new Elysia()
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
            pending: t.Optional(t.Literal(true)),
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
      .derive(async ({ jwt, headers, cookie, request }) => {
        // The showcase sends session and unlock comma-joined (`Bearer <s>, Showcase <u>`): only
        // the Bearer half is a session here, the Showcase half belongs to the public routes.
        const bearerHalf = headers['authorization']
          ?.split(',')
          .map((half) => half.trim())
          .find((half) => half.startsWith('Bearer '));
        let token: string | null | undefined = bearerHalf ? bearerHalf.slice(7) : null;

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
        // runs on every request, including public ones (GET /api/kerescheck, GET /api/swagger, POST
        // /auth/login...). Throwing 401 here used to reject those too, just because a client
        // happened to carry a stale token; each route that actually requires auth already does
        // its own `if (!user) { 401 }` check right after this runs, so nothing is lost by
        // deferring the rejection to there instead.
        let payload: JWTPayload | null;
        try {
          payload = ((await jwt.verify(token)) || null) as JWTPayload | null;
        } catch {
          return { user: null };
        }
        // A pending account's session reaches only the verification routes - refused here, before any route runs,
        // with no database hit. Outside the try: the refusal is an answer, not an invalid token.
        if (payload?.pending) assertPendingSessionMayReach(request);
        return { user: payload };
      })
      // Who did what, for the administrators: after the session is known, before any route.
      .use(requestAudit)
      .onError(({ code, error, set, path, request, user, params }) => {
        const err = error instanceof Error ? error : new Error(String(error));
        const label = `${request.method} ${path}`;
        const userId = (user as JWTPayload | null)?.userId ?? null;
        // Only routes with a :storyId in their params carry this - it does not force the field where it is
        // not meaningful (not every route is scoped to a story).
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
          return err.code ? { message: err.message, code: err.code } : { message: err.message };
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
      // The root, the hosted client and the favicon answer before the API: none of them can be shadowed by it.
      .use(webEntryRoutes(surfaces))
      .use(createApiRoutes())
      // The panel, the showcase and the fallback to the root come last, so none of them shadows an API route.
      .use(webPageRoutes(surfaces))
  );
}
