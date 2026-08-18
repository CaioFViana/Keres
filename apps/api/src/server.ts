import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { createApp } from './index';
import { reconcileRootAdmin } from './services/RootAdminService';
import { assertMediaStorageConfiguration } from './services/MediaStorageConfigurationService';
import { mediaStorageService } from './services/MediaStorageService';
import { persistApiLog } from './services/ApiLogService';
import { logger, setLogSink } from './utils/logger';

// Efeitos de produção ficam fora de `createApp()`, permitindo testes de rota sem banco real.
try {
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
} catch (error) {
  // Sem isto, uma falha aqui (ex.: Postgres fora do ar) subia como unhandled rejection do
  // próprio Bun - sem passar pelo `logger` estruturado que o resto do app usa, e sem deixar
  // claro que foi o boot que falhou (em vez de alguma requisição). Toda falha aqui é fatal -
  // a API não faz sentido sem migração/config de mídia/admin reconciliados - então também
  // derruba o processo explicitamente em vez de deixar a exceção não tratada decidir.
  logger.error('Fatal error during startup', error);
  process.exit(1);
}

const app = await createApp();
app.listen(
  {
    port: env.PORT,
    // Bun buffers the whole request body into memory before any route code runs - the
    // MEDIA_MAX_BYTES check in media.route.ts only rejects an oversized upload *after* that
    // buffering already happened, which doesn't bound memory use at all. This cap runs first,
    // at the HTTP layer, before any handler (or auth) sees the request. 8MB of headroom over
    // MEDIA_MAX_BYTES covers multipart overhead; every other route's payloads (sync batches,
    // JSON bodies) are nowhere near this size in practice.
    maxRequestBodySize: env.MEDIA_MAX_BYTES + 8 * 1024 * 1024,
  },
  ({ hostname, port }) => {
    logger.info(`Elysia is running at http://${hostname}:${port}`);
    logger.info(`Swagger UI at http://${hostname}:${port}/swagger`);
  },
);
