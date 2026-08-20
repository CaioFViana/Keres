/**
 * A route deliberately rejecting a request with a specific status and a safe,
 * user-facing message - as opposed to an error that merely bubbled up from a library
 * (drizzle/pg, a bug, etc.) and defaults to `set.status = 500` the same way Elysia does
 * for any unclassified thrown error. That collision is why `set.status === 500` alone
 * can't tell "the app chose 500 on purpose" apart from "nothing chose it" - this class
 * is the unambiguous signal `onError` needs to relay the former and sanitize the latter.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** `unique_violation` do Postgres. */
const UNIQUE_VIOLATION = '23505';
/** O SQLite não distingue qual restrição foi violada pelo código; o texto é que diz. */
const SQLITE_CONSTRAINT = 'SQLITE_CONSTRAINT';

/**
 * Código de erro do banco, procurado também em `.cause`.
 *
 * O drizzle não repassa o erro do driver: ele lança um `Error` próprio ("Failed query: ...")
 * com o original pendurado em `cause`. Por isso um `(error as { code?: string }).code ===
 * '23505'` escrito direto no `catch` nunca é verdadeiro numa query feita pelo drizzle - o
 * tratamento vira código morto e a rota devolve 500 no lugar do resultado que ela pretendia dar.
 */
export function postgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') {
      return code;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Mensagem de erro do driver, procurada também em `.cause` (mesmo motivo do código acima). */
function errorMessageChain(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const message = (current as { message?: unknown }).message;
    if (typeof message === 'string') {
      messages.push(message);
    }
    current = (current as { cause?: unknown }).cause;
  }
  return messages.join(' | ');
}

/**
 * Violação de restrição de unicidade, não importa o motor.
 *
 * O Postgres tem um código só para isso (`23505`). O SQLite devolve `SQLITE_CONSTRAINT` para
 * qualquer restrição - chave estrangeira, `NOT NULL`, `CHECK` - e só o texto diz qual foi, daí
 * a checagem pela mensagem. Confundir uma violação de chave estrangeira com uma de unicidade
 * faria, por exemplo, o cadastro tentar de novo com outra tag para sempre.
 */
export function isUniqueViolation(error: unknown): boolean {
  const code = postgresErrorCode(error);
  if (code === UNIQUE_VIOLATION) {
    return true;
  }
  return code === SQLITE_CONSTRAINT && /UNIQUE constraint failed/i.test(errorMessageChain(error));
}

/**
 * Nome da constraint/índice que causou a violação (ex.: `users_username_unique`), procurado
 * em `.cause` pelo mesmo motivo de `postgresErrorCode`. Uma tabela pode ter mais de uma
 * restrição de unicidade - `isUniqueViolation` sozinho não diz qual delas foi violada, e
 * assumir que só pode ser uma específica (ex.: username vs tag em `users`) faz um retry
 * pensado para uma colisão de verdade re-tentar a mesma operação, sem checar isto, contra
 * uma restrição diferente que nunca vai passar.
 */
export function postgresErrorConstraint(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const constraint = (current as { constraint?: unknown }).constraint;
    if (typeof constraint === 'string') {
      return constraint;
    }
    current = (current as { cause?: unknown }).cause;
  }

  // O SQLite não expõe a restrição num campo: ela vem no texto, e de duas formas. Para um
  // índice de expressão (`lower(tag)`) ele dá o nome do índice - que é justamente o que quem
  // chama compara; para um índice comum, dá as colunas.
  const message = errorMessageChain(error);
  const namedIndex = /UNIQUE constraint failed: index '([^']+)'/i.exec(message)?.[1];
  if (namedIndex) {
    return namedIndex;
  }
  const columns = /UNIQUE constraint failed: ([\w., ]+)/i.exec(message)?.[1];
  return columns?.trim().replace(/\./g, '_');
}
