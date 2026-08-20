import * as dotenv from 'dotenv';
import type { Config } from 'drizzle-kit';

dotenv.config({ path: './.env' });

/**
 * Geração das migrações do SQLite.
 *
 * `DATABASE_DRIVER` é fixado aqui antes de qualquer coisa: `src/db/schema/columns.ts` lê essa
 * variável no momento em que é importado para decidir se constrói tabelas `pgTable` ou
 * `sqliteTable`. Sem isto, o drizzle-kit leria o schema no dialeto do Postgres e tentaria
 * gerar SQL de SQLite a partir dele.
 *
 * As migrações do Postgres continuam saindo de `drizzle.config.ts`, em `drizzle/`, intocadas.
 */
process.env.DATABASE_DRIVER = 'sqlite';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle-sqlite',
  dialect: 'sqlite',
  dbCredentials: {
    // Só usado por comandos que falam com o banco (`push`, `studio`); `generate` compara o
    // schema com o que já está em `drizzle-sqlite/` e não abre conexão nenhuma.
    url: process.env.DATABASE_URL?.startsWith('file:')
      ? process.env.DATABASE_URL
      : 'file:./keres.db',
  },
  verbose: true,
  strict: true,
} satisfies Config;
