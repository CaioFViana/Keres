// Configuração mínima para importar a aplicação sem depender de um arquivo .env do operador.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/keres_test';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-at-least-thirty-two-characters';
process.env.JWT_SECRET_REFRESH ??= 'test-refresh-secret-that-is-at-least-thirty-two-characters';
process.env.NODE_ENV = 'test';
