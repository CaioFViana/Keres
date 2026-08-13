import { Elysia } from 'elysia';
import { adminApiLogRoutes } from './adminApiLog.route';
import { adminRecoveryRoutes } from './adminRecovery.route';
import { adminRegistrationRoutes } from './adminRegistration.route';
import { adminTierRoutes } from './adminTier.route';
import { adminUserRoutes } from './adminUser.route';

/**
 * Composição de todas as rotas administrativas, montadas em `/admin/api/*` (não `/admin/*`
 * puro - esse prefixo é reservado para servir o app estático do painel, ver index.ts).
 *
 * Cada módulo (adminUser.route.ts etc.) chama `requireAdmin(user)` diretamente em vez de
 * compor um plugin Elysia via `.use()` - testado que propagar um `.derive()` de guard
 * através de módulos/grupos não flui de forma confiável para o TypeScript nesta versão do
 * Elysia. Uma função simples é mais simples e evita essa armadilha.
 */
export const adminRoutes = new Elysia()
  .group('/users', (app) => app.use(adminUserRoutes))
  .group('/tiers', (app) => app.use(adminTierRoutes))
  .group('/registration-settings', (app) => app.use(adminRegistrationRoutes))
  .group('/recovery', (app) => app.use(adminRecoveryRoutes))
  .group('/logs', (app) => app.use(adminApiLogRoutes));
