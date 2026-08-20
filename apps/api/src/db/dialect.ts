/**
 * Qual banco esta API está usando.
 *
 * Lido do ambiente direto, e não de `config/env.ts`, porque o schema (`db/schema/**`) importa
 * este módulo e o drizzle-kit carrega o schema fora do processo da API - lá `env.ts` e as suas
 * validações de JWT, S3 e afins não têm como ser satisfeitas. A escolha do dialeto é a única
 * coisa que o schema precisa saber, e ela é uma string só.
 */

export type DatabaseDriver = 'postgres' | 'sqlite';

export const DATABASE_DRIVER: DatabaseDriver =
  process.env.DATABASE_DRIVER === 'sqlite' ? 'sqlite' : 'postgres';

export const usingSqlite = DATABASE_DRIVER === 'sqlite';
