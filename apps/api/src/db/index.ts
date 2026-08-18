import { AsyncLocalStorage } from 'node:async_hooks';
import * as dotenv from 'dotenv';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import * as schema from './schema';

dotenv.config({ path: '../.env' });

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

type Db = NodePgDatabase<typeof schema>;

const rawDb: Db = drizzle(pool, { schema, logger: false });

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
