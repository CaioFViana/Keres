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

/**
 * Código de erro do Postgres, procurado também em `.cause`.
 *
 * O drizzle não repassa o erro do `pg`: ele lança um `Error` próprio ("Failed query: ...") com
 * o original pendurado em `cause`. Por isso um `(error as { code?: string }).code === '23505'`
 * escrito direto no `catch` nunca é verdadeiro numa query feita pelo drizzle - o tratamento
 * vira código morto e a rota devolve 500 no lugar do resultado que ela pretendia dar.
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

/** Violação de restrição de unicidade, seja ela lançada pelo `pg` ou embrulhada pelo drizzle. */
export function isUniqueViolation(error: unknown): boolean {
  return postgresErrorCode(error) === UNIQUE_VIOLATION;
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
  return undefined;
}
