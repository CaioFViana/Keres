/**
 * A mesma suíte de integração, rodando sobre um arquivo SQLite.
 *
 * `DATABASE_DRIVER` é fixado aqui, antes de qualquer módulo carregar, pelo mesmo motivo de
 * `drizzle.sqlite.config.ts`: o schema decide o dialeto no momento em que é importado. Um
 * arquivo de config em vez de uma variável na linha de comando porque `VAR=valor comando` não
 * funciona no PowerShell, e isto precisa rodar igual em qualquer máquina.
 */
process.env.DATABASE_DRIVER = 'sqlite';

// eslint-disable-next-line import/first
import baseConfig from './vitest.integration.config';

export default baseConfig;
