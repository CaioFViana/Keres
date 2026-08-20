import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { drizzle as drizzlePostgres, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { usingSqlite } from './dialect';
import * as schema from './schema';

dotenv.config({ path: '../.env' });

/**
 * A conexão com o banco, em um dos dois motores.
 *
 * `DATABASE_DRIVER=postgres` (padrão) usa um servidor Postgres, como sempre. `sqlite` usa um
 * arquivo local via libSQL, para quem quer subir a API sem manter um banco à parte.
 *
 * libSQL, e não `bun:sqlite`/`better-sqlite3`: os drivers SQLite síncronos do drizzle recusam
 * um callback `async` em `.transaction()`, e toda transação desta API é assíncrona - inclusive
 * o `withTransaction` abaixo, que é a espinha da sincronização. libSQL fala SQLite com uma API
 * assíncrona, então nada disso precisou mudar.
 *
 * O tipo exportado é o do Postgres nos dois casos, pelo mesmo motivo de `schema/columns.ts`: os
 * construtores de coluna foram escolhidos para os tipos inferidos serem idênticos, então quem
 * consulta não distingue um do outro.
 */
type Db = NodePgDatabase<typeof schema>;

function createPostgresDb(): Db {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Explicit instead of relying on `pg`'s defaults, since this pool is shared by the whole
    // API process. `max` bounds how many connections one instance can hold open against
    // Postgres at once; the two timeouts turn "Postgres is unreachable" into a clear error
    // within seconds instead of a request hanging until the client itself times out.
    max: 20,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

  // node-postgres emits 'error' on the pool when an idle client's connection dies
  // (DB restart, network blip). Without a listener, that's an unhandled EventEmitter
  // 'error' - Node throws it as an uncaught exception and kills the whole process.
  pool.on('error', (error) => {
    logger.error('Postgres pool error on an idle client', error);
  });

  return drizzlePostgres(pool, { schema, logger: false });
}

/**
 * `undefined` num parâmetro vira `NULL`.
 *
 * O `pg` faz essa conversão sozinho, e o código da API conta com isso em toda coluna opcional
 * (`tierId: defaultTierId`, com `defaultTierId` possivelmente ausente). O libSQL, mais
 * estrito, rejeita `undefined` e a inserção inteira falha. Normalizar aqui, na borda do
 * driver, faz os dois motores se comportarem igual sem tocar em nenhuma das chamadas.
 */
function toNullable(args: unknown): unknown {
  if (Array.isArray(args)) {
    return args.map((value) => (value === undefined ? null : value));
  }
  if (args && typeof args === 'object') {
    return Object.fromEntries(
      Object.entries(args as Record<string, unknown>).map(([key, value]) => [
        key,
        value === undefined ? null : value,
      ]),
    );
  }
  return args;
}

function sanitiseStatement(statement: unknown): unknown {
  if (statement && typeof statement === 'object' && 'args' in statement) {
    const typed = statement as { args?: unknown };
    return { ...typed, args: toNullable(typed.args) };
  }
  return statement;
}

/** Envolve `execute`/`batch` de um cliente (ou de uma transação) com a normalização acima. */
function sanitiseClient<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') {
        return value;
      }
      if (prop === 'execute') {
        return (statement: unknown, ...rest: unknown[]) =>
          value.call(target, sanitiseStatement(statement), ...rest);
      }
      if (prop === 'batch') {
        return (statements: unknown[], ...rest: unknown[]) =>
          value.call(target, statements.map(sanitiseStatement), ...rest);
      }
      if (prop === 'transaction') {
        // A transação é outro objeto com o seu próprio `execute`, então precisa do mesmo cuidado.
        return async (...args: unknown[]) => sanitiseClient(await value.apply(target, args));
      }
      return value.bind(target);
    },
  });
}

function createSqliteDb(): Db {
  const client = sanitiseClient(createClient({ url: process.env.DATABASE_URL! }));
  // Sem chaves estrangeiras o SQLite aceita, em silêncio, uma linha apontando para um id que
  // não existe - o Postgres nunca aceitou, e o schema conta com isso. É desligado por padrão.
  void client.execute('PRAGMA foreign_keys = ON');
  return drizzleLibsql(client, { schema, logger: false }) as unknown as Db;
}

const rawDb: Db = usingSqlite ? createSqliteDb() : createPostgresDb();

/**
 * Torna uma transação implicitamente visível para toda chamada ao `db` exportado abaixo
 * feita durante `fn` - direta ou indireta, em qualquer profundidade de chamada - sem
 * precisar passar um `tx` por parâmetro em nenhum dos handlers de sincronização. Eles
 * continuam importando e chamando `db` exatamente como antes; é o Proxy logo abaixo que
 * resolve para a transação ativa neste `AsyncLocalStorage` quando existir uma.
 */
const transactionContext = new AsyncLocalStorage<Db>();

/**
 * Como `db.transaction(callback)`, mas o `callback` roda com a transação escondida no
 * contexto assíncrono em vez de recebida por parâmetro. Sempre abre uma transação nova a
 * partir da conexão comum - não é ela mesma consciente de aninhamento; quem aninha
 * corretamente (como savepoint) é `db.transaction(...)` chamado através do Proxy abaixo
 * enquanto já existe uma transação ativa neste contexto, que é o caso de uso real hoje
 * (handlers de entidade que já chamam `db.transaction` por conta própria, agora rodando
 * dentro do `withTransaction` do `SyncService`).
 */
export function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return rawDb.transaction((tx) => transactionContext.run(tx as unknown as Db, fn));
}

/**
 * Proxy sobre a conexão comum: cada propriedade/método acessado resolve para a transação
 * ativa (se houver um `withTransaction` em andamento nesta cadeia assíncrona) ou cai para a
 * conexão comum, sem que quem chama precise saber a diferença nem mudar uma linha. Métodos
 * são religados (`.bind`) ao alvo resolvido porque `proxy.metodo(...)` vincularia `this` ao
 * proxy, não ao objeto de onde o método realmente veio - sem isto os métodos internos do
 * drizzle quebrariam tentando ler estado de `this` no lugar errado.
 */
export const db: Db = new Proxy(rawDb, {
  get(target, prop) {
    const active = transactionContext.getStore() ?? target;
    const value = (active as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(active) : value;
  },
}) as Db;
