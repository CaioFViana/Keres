import * as pg from 'drizzle-orm/pg-core';
import * as sqlite from 'drizzle-orm/sqlite-core';
import { usingSqlite } from '../dialect';

/**
 * Uma definição de tabela, dois dialetos.
 *
 * O drizzle não tem schema agnóstico: `pgTable` e `sqliteTable` são construtores diferentes,
 * com tipos de coluna diferentes. Em vez de manter duas cópias das 40 tabelas - que
 * inevitavelmente divergiriam - cada arquivo de tabela importa os construtores daqui, e é este
 * módulo que escolhe o dialeto, uma vez, a partir de `DATABASE_DRIVER`.
 *
 * Os tipos declarados são os do Postgres, que é o dialeto de referência. Isso não é uma mentira
 * conveniente: os modos do SQLite abaixo foram escolhidos justamente para o tipo *inferido* de
 * cada coluna ficar idêntico nos dois lados - `timestamp` devolve `Date`, `boolean` devolve
 * `boolean`, `json` devolve o objeto. Um serviço não tem como notar a diferença, e é por isso
 * que nenhum deles precisou mudar.
 *
 * O que o SQLite não tem:
 *   - tipo `timestamp`: vira inteiro em milissegundos (`timestamp_ms`), convertido de/para
 *     `Date` pelo drizzle. Milissegundos, e não segundos, porque a sincronização ordena
 *     operações por `updatedAt` - truncar para o segundo empataria escritas próximas;
 *   - tipo `boolean`: vira inteiro 0/1, convertido do mesmo jeito;
 *   - `jsonb`: vira texto, serializado pelo drizzle;
 *   - tipos ENUM: viram texto com a lista de valores válidos no tipo do TypeScript;
 *   - `bigint` de 64 bits distinto: `INTEGER` já é 64 bits.
 */

/** `pgTable`/`sqliteTable`. A assinatura é a mesma nos dois. */
export const table = (usingSqlite ? sqlite.sqliteTable : pg.pgTable) as typeof pg.pgTable;

export const text = (usingSqlite ? sqlite.text : pg.text) as typeof pg.text;

export const integer = (usingSqlite ? sqlite.integer : pg.integer) as typeof pg.integer;

/**
 * Número com casas decimais. `real` existe nos dois dialetos e o tipo inferido é `number` dos
 * dois lados, então serviços não notam a diferença - mesmo critério das colunas acima.
 */
export const real = (usingSqlite ? sqlite.real : pg.real) as typeof pg.real;

/** Inteiro de 64 bits. `INTEGER` do SQLite já é 64 bits; no Postgres é `bigint`. */
export const bigintNumber = (
  usingSqlite
    ? (name: string) => sqlite.integer(name)
    : (name: string) => pg.bigint(name, { mode: 'number' })
) as (name: string) => ReturnType<typeof pg.bigint<string, 'number'>>;

export const boolean = (
  usingSqlite ? (name: string) => sqlite.integer(name, { mode: 'boolean' }) : pg.boolean
) as typeof pg.boolean;

/** Data/hora anulável. */
export const timestamp = (
  usingSqlite ? (name: string) => sqlite.integer(name, { mode: 'timestamp_ms' }) : pg.timestamp
) as typeof pg.timestamp;

/**
 * Data/hora obrigatória, preenchida com "agora" quando quem insere não informa.
 *
 * Existe como um construtor próprio porque `.defaultNow()` só existe no Postgres, e o padrão
 * `timestamp(...).notNull().defaultNow()` aparece 70 e poucas vezes: encadear métodos devolve
 * um construtor novo a cada passo, então não há como acrescentar `defaultNow` ao do SQLite sem
 * embrulhar tudo em proxy. No SQLite o valor sai do próprio processo (`$defaultFn`), o que dá
 * no mesmo para quem insere pelo drizzle - e é o único caminho aqui, já que nenhuma escrita
 * desta API é feita em SQL cru.
 */
export const timestampNow = (
  usingSqlite
    ? (name: string) =>
        sqlite
          .integer(name, { mode: 'timestamp_ms' })
          .notNull()
          .$defaultFn(() => new Date())
    : (name: string) => pg.timestamp(name).notNull().defaultNow()
) as (
  name: string,
  // O tipo precisa carregar a marca de "tem valor padrão", senão o drizzle passa a exigir
  // `createdAt`/`updatedAt` em todo insert.
) => ReturnType<ReturnType<ReturnType<typeof pg.timestamp>['notNull']>['defaultNow']>;

/** Documento JSON. `jsonb` no Postgres, texto serializado pelo drizzle no SQLite. */
export const json = (
  usingSqlite ? (name: string) => sqlite.text(name, { mode: 'json' }) : pg.jsonb
) as typeof pg.jsonb;

export const index = (usingSqlite ? sqlite.index : pg.index) as typeof pg.index;

export const uniqueIndex = (
  usingSqlite ? sqlite.uniqueIndex : pg.uniqueIndex
) as typeof pg.uniqueIndex;

export const unique = (usingSqlite ? sqlite.unique : pg.unique) as typeof pg.unique;

/**
 * Uma tabela sob outro nome, para a mesma tabela aparecer duas vezes numa consulta.
 * `FriendshipService` usa isso para juntar `users` com ela mesma (quem enviou e quem recebeu).
 */
export const alias = (usingSqlite ? sqlite.alias : pg.alias) as typeof pg.alias;

/**
 * Um conjunto fechado de valores.
 *
 * No Postgres é um tipo ENUM de verdade; no SQLite é uma coluna de texto cujo tipo no
 * TypeScript é a união dos valores - o banco não recusa um valor fora da lista, mas o
 * compilador sim, e todas as escritas passam pelo drizzle.
 *
 * `enumValues` é exposto porque algumas rotas montam o schema de validação a partir dele
 * (`story.route.ts`, `SyncService`), e isso precisa funcionar igual nos dois dialetos.
 */
export function dbEnum<const T extends readonly [string, ...string[]]>(name: string, values: T) {
  const pgType = pg.pgEnum(name, values);
  // No Postgres o próprio `pgEnum` é o construtor de coluna - devolvê-lo intacto mantém o
  // `CREATE TYPE` nas migrações. No SQLite, texto com a união de valores no tipo.
  const column = usingSqlite
    ? (columnName: string) => sqlite.text(columnName, { enum: values })
    : pgType;

  return Object.assign(column, { enumValues: values }) as typeof pgType;
}
