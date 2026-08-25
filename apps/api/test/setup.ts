// Configuração mínima para importar a aplicação sem depender de um arquivo .env do operador.
//
// O `??=` importa: definir a variável ANTES de qualquer módulo carregar faz o `dotenv.config()`
// de `src/db` e `src/config/env` não sobrescrevê-la (dotenv nunca substitui chave já
// existente). É isso que garante que uma suíte nunca encoste no banco de desenvolvimento.
//
// O padrão aponta para o Postgres descartável de `docker-compose.test.yml`, então
// `bun run test:integration` funciona localmente sem configurar nada. Com
// `DATABASE_DRIVER=sqlite` a suíte roda sobre um arquivo temporário e não precisa de banco
// nenhum no ar - ver `test:integration:sqlite`.
if (process.env.DATABASE_DRIVER === 'sqlite') {
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  process.env.DATABASE_URL ??= `file:${join(tmpdir(), 'keres-test.db')}`;
} else {
  // A porta é a mesma do `docker-compose.test.yml`, e sai do mesmo lugar: `KERES_TEST_DB_PORT`.
  // O padrão 45432 existe porque a faixa 55389-55488 fica reservada pelo Windows em máquinas
  // com Hyper-V/WSL, e o Docker não consegue publicar nela.
  const port = process.env.KERES_TEST_DB_PORT ?? '45432';
  process.env.DATABASE_URL ??= `postgres://keres_test:keres_test@localhost:${port}/keres_test`;
}
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-at-least-thirty-two-characters';
process.env.JWT_SECRET_REFRESH ??= 'test-refresh-secret-that-is-at-least-thirty-two-characters';
process.env.NODE_ENV = 'test';

// Mídia gravada em disco vai para uma pasta descartável, nunca para a `./media-storage` do
// operador (o padrão de `env.ts`, relativo ao diretório de onde o processo subiu).
import * as os from 'node:os';
import * as path from 'node:path';
process.env.MEDIA_STORAGE_PATH ??= path.join(os.tmpdir(), 'keres-media-test');
