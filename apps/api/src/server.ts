import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { createApp } from './index';
import { reconcileRootAdmin } from './services/RootAdminService';
import { logger } from './utils/logger';

// Efeitos de produção ficam fora de `createApp()`, permitindo testes de rota sem banco real.
await runMigrations();
await reconcileRootAdmin();

const app = await createApp();
app.listen(env.PORT, ({ hostname, port }) => {
  logger.info(`Elysia is running at http://${hostname}:${port}`);
  logger.info(`Swagger UI at http://${hostname}:${port}/swagger`);
});
