import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { createApp } from './index';
import { reconcileRootAdmin } from './services/RootAdminService';
import { assertMediaStorageConfiguration } from './services/MediaStorageConfigurationService';
import { mediaStorageService } from './services/MediaStorageService';
import { persistApiLog } from './services/ApiLogService';
import { logger, setLogSink } from './utils/logger';

// Efeitos de produção ficam fora de `createApp()`, permitindo testes de rota sem banco real.
await runMigrations();
// Só depois das migrações: a tabela `api_logs` pode não existir ainda num primeiro boot.
// Os poucos logs antes deste ponto continuam só-console, o que é aceitável.
setLogSink(persistApiLog);
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
