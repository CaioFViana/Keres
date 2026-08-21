import { ilike, like, sql, type SQL } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';
import { usingSqlite } from './dialect';

/**
 * Operadores cujo SQL muda de um motor para o outro.
 *
 * O resto das consultas desta API é escrito pelo drizzle e sai idêntico nos dois dialetos;
 * o que sobra é isto.
 */

/**
 * Busca por trecho, ignorando maiúsculas e minúsculas.
 *
 * `ILIKE` é do Postgres. No SQLite o `LIKE` já ignora caixa por conta própria, mas só em
 * ASCII - então a comparação é feita com os dois lados em minúsculas, o que dá o mesmo
 * resultado para o alfabeto latino sem acento.
 *
 * Diferença conhecida e aceita: no Postgres "José" casa com "josé"; no SQLite não, porque nem
 * `LIKE` nem `lower()` de lá conhecem acentuação. Isso afeta a busca administrativa por nome
 * de usuário e título de história - encontra menos, nunca encontra errado.
 */
export function insensitiveLike(column: AnyColumn, pattern: string): SQL {
  if (usingSqlite) {
    return like(sql`lower(${column})`, pattern.toLowerCase());
  }
  return ilike(column, pattern);
}

/**
 * Serializa transações concorrentes que mexem no mesmo par de usuários.
 *
 * No Postgres é um advisory lock por transação: dois pedidos de amizade em sentidos opostos
 * (A→B e B→A) disputam a mesma chave e nunca leem "não existe" ao mesmo tempo - a restrição de
 * unicidade sozinha só pega a duplicata exata (A→B duas vezes).
 *
 * No SQLite não existe advisory lock, e nem é preciso: a transação é aberta em modo
 * `immediate` (ver `writeTransactionConfig`), que toma a trava de escrita do banco inteiro
 * logo no início. É uma serialização mais grosseira - vale para todos os escritores, não só
 * para este par - e para um servidor de um processo só isso é aceitável.
 */
export async function lockUserPair(
  tx: { execute: (query: SQL) => Promise<unknown> },
  firstUserId: string,
  secondUserId: string,
): Promise<void> {
  if (usingSqlite) {
    return;
  }
  const [lockKeyA, lockKeyB] = [firstUserId, secondUserId].sort();
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKeyA}), hashtext(${lockKeyB}))`);
}

/**
 * Configuração para uma transação que vai escrever e não pode competir com outra.
 *
 * Vazia no Postgres, onde a serialização vem do advisory lock acima. No SQLite pede
 * `immediate`, que adquire a trava de escrita ao abrir em vez de no primeiro `INSERT` - sem
 * isso, duas transações que leem antes de escrever podem chegar juntas à escrita e uma delas
 * morrer com "database is locked".
 */
export const writeTransactionConfig = (usingSqlite ? { behavior: 'immediate' } : {}) as Record<
  string,
  never
>;
