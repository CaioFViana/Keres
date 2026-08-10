import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { createApp } from './index';
import { reconcileRootAdmin } from './services/RootAdminService';
import { assertMediaStorageConfiguration } from './services/MediaStorageConfigurationService';
import { mediaStorageService } from './services/MediaStorageService';
import { logger } from './utils/logger';

// Efeitos de produção ficam fora de `createApp()`, permitindo testes de rota sem banco real.
await runMigrations();
await assertMediaStorageConfiguration();
const abandonedMediaUploads = await mediaStorageService.cleanupTemporaryFiles();
if (abandonedMediaUploads > 0) {
  logger.info(`Removed ${abandonedMediaUploads} abandoned temporary media upload(s).`);
}
await reconcileRootAdmin();

const app = await createApp();
app.listen(env.PORT, ({ hostname, port }) => {
  logger.info(`Elysia is running at http://${hostname}:${port}`);
  logger.info(`Swagger UI at http://${hostname}:${port}/swagger`);
});
