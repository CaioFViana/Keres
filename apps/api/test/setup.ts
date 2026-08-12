// Configuração mínima para importar a aplicação sem depender de um arquivo .env do operador.
//
// O `??=` importa: definir a variável ANTES de qualquer módulo carregar faz o `dotenv.config()`
// de `src/db` e `src/config/env` não sobrescrevê-la (dotenv nunca substitui chave já
// existente). É isso que garante que uma suíte nunca encoste no banco de desenvolvimento.
//
// O padrão aponta para o Postgres descartável de `docker-compose.test.yml`, então
// `bun run test:integration` funciona localmente sem configurar nada.
process.env.DATABASE_URL ??= 'postgres://keres_test:keres_test@localhost:55432/keres_test';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-at-least-thirty-two-characters';
process.env.JWT_SECRET_REFRESH ??= 'test-refresh-secret-that-is-at-least-thirty-two-characters';
process.env.NODE_ENV = 'test';
