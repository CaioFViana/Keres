import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { AppDrizzleClient } from '../../src/db';
import migrations from '../../src/db/migrations';
import * as schema from '../../src/db/schema';

/**
 * Banco de teste em memória para os serviços que falam com o SQLite.
 *
 * `expo-sqlite` não roda em Node, mas as tabelas são declaradas com `drizzle-orm/sqlite-core` -
 * as mesmas definições servem para o driver `better-sqlite3`, então os serviços rodam contra o
 * schema de verdade em vez de um mock de banco.
 *
 * As migrações também são as de produção, sem cópia: cada arquivo em `src/db/migrations` é uma
 * função que recebe algo com `execAsync(sql)`, então basta entregar um objeto com esse método
 * apoiado no `exec` do better-sqlite3. Se uma migração nova quebrar o schema, esta suíte
 * quebra junto, que é exatamente o que se quer.
 */
export interface TestDatabase {
  /**
   * Tipado como o cliente de produção (`AppDrizzleClient`, sobre expo-sqlite) para os serviços
   * poderem ser chamados sem cast em cada teste.
   *
   * A conversão é segura e fica contida neste ponto: as duas instâncias são o mesmo
   * `SQLiteDatabase` do drizzle sobre o mesmo schema, e divergem só no tipo do `RunResult` que
   * cada driver devolve (`lastInsertRowId`/`changes` do expo-sqlite contra o do
   * better-sqlite3) - um valor que nenhum serviço deste app lê.
   */
  db: AppDrizzleClient;
  raw: Database.Database;
  close: () => void;
}

/**
 * better-sqlite3 é síncrono por natureza: seu `.transaction(fn)` nativo checa, na volta de
 * `fn`, se o resultado tem `.then` e lança `TypeError: Transaction function cannot return a
 * promise` se tiver - e chamar uma função `async` sempre devolve uma Promise, não importa o
 * que tenha dentro. Isso quebra todo `db.transaction(async (tx) => {...})` do app (que roda
 * fino em produção, sobre `expo-sqlite`, que é async de verdade).
 *
 * Detectar "é uma função async" antes de chamar não é confiável: o Babel do Jest transpila
 * `async (tx) => {...}` para uma função comum apoiada em generator (`asyncToGenerator`), então
 * `fn.constructor.name`/`Object.prototype.toString.call(fn)` não acusam `AsyncFunction` em
 * teste, só em produção. Detectar errado é pior que não detectar: cair no wrapper nativo por
 * engano faz ele lançar o `TypeError` de imediato, sem nunca dar `await` no resultado - e como
 * ninguém mais segura essa Promise, a continuação do callback (o código depois do primeiro
 * `await`) roda mais tarde, sem transação nenhuma por baixo, como uma rejeição não tratada.
 *
 * Por isso a instância é sobrescrita (não o protótipo - fica isolado a este banco de teste)
 * para SEMPRE rodar a própria implementação, decidindo só depois de chamar `fn`: se o retorno
 * for "thenable", dá `await` de verdade nele antes de decidir commit/rollback; se não for,
 * decide na hora, igual ao wrapper nativo faria com um callback síncrono.
 */
function patchAsyncTransactions(raw: Database.Database): void {
  const isThenable = (value: unknown): value is PromiseLike<unknown> =>
    !!value && typeof (value as { then?: unknown }).then === 'function';

  const run = (fn: (...args: never[]) => unknown, begin: string, args: never[]) => {
    const nested = raw.inTransaction;
    raw.exec(nested ? 'SAVEPOINT async_tx' : begin);

    const commit = <T>(value: T) => {
      raw.exec(nested ? 'RELEASE async_tx' : 'COMMIT');
      return value;
    };
    const rollback = (error: unknown): never => {
      raw.exec(nested ? 'ROLLBACK TO async_tx' : 'ROLLBACK');
      if (nested) raw.exec('RELEASE async_tx');
      throw error;
    };

    let result: unknown;
    try {
      result = fn(...args);
    } catch (error) {
      rollback(error);
    }

    return isThenable(result) ? Promise.resolve(result).then(commit, rollback) : commit(result);
  };

  raw.transaction = ((fn: (...args: never[]) => unknown) => {
    const wrapper = (...args: never[]) => run(fn, 'BEGIN', args);
    wrapper.deferred = (...args: never[]) => run(fn, 'BEGIN DEFERRED', args);
    wrapper.immediate = (...args: never[]) => run(fn, 'BEGIN IMMEDIATE', args);
    wrapper.exclusive = (...args: never[]) => run(fn, 'BEGIN EXCLUSIVE', args);
    wrapper.default = wrapper;
    wrapper.database = raw;
    return wrapper;
  }) as unknown as Database.Database['transaction'];
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  patchAsyncTransactions(raw);

  const expoLikeDatabase = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
  };

  for (const migration of migrations) {
    await migration.run(expoLikeDatabase as never);
  }

  return {
    db: drizzle(raw, { schema }) as unknown as AppDrizzleClient,
    raw,
    close: () => raw.close(),
  };
}

/** Tabelas presentes no banco, para checar que as migrações realmente rodaram. */
export function listTables(raw: Database.Database): string[] {
  return raw
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all()
    .map((row) => row.name)
    .sort();
}
