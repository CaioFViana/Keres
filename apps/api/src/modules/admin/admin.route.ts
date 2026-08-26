import { Elysia } from 'elysia';
import { adminApiLogRoutes } from './adminApiLog.route';
import { adminRecoveryRoutes } from './adminRecovery.route';
import { adminRegistrationRoutes } from './adminRegistration.route';
import { adminShowcaseRoutes } from './adminShowcase.route';
import { adminTierRoutes } from './adminTier.route';
import { adminUserRoutes } from './adminUser.route';

/**
 * Composition of every administrative route, mounted at `/api/admin/*`; `/admin/*` is reserved for
 * serving the panel's static app, see index.ts.
 *
 * Each module (adminUser.route.ts and friends) calls `requireAdmin(user)` directly instead of
 * composing an Elysia plugin via `.use()` - it was tested that propagating a guard's `.derive()`
 * through modules/groups does not flow reliably into TypeScript in this version of Elysia. A plain
 * function is simpler and avoids that trap.
 */
export const adminRoutes = new Elysia()
  .group('/users', (app) => app.use(adminUserRoutes))
  .group('/tiers', (app) => app.use(adminTierRoutes))
  .group('/registration-settings', (app) => app.use(adminRegistrationRoutes))
  .group('/showcase-settings', (app) => app.use(adminShowcaseRoutes))
  .group('/recovery', (app) => app.use(adminRecoveryRoutes))
  .group('/logs', (app) => app.use(adminApiLogRoutes));
