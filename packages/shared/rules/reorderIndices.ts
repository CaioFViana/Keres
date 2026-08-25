export interface ReorderItem {
  id: string;
  newIndex: number;
}

/**
 * A ordem final de uma lista arrastada, no formato que a sincronização espera: `newIndex`
 * **1..N contíguo**.
 *
 * A base não é escolha de estilo. O servidor recusa uma reordenação cujo menor índice não seja 1
 * ou que não termine em N, e a recusa não aparece como erro na tela: vira um conflito de
 * sincronização, com a nova ordem ficando só no aparelho. Uma função só, usada por todas as
 * modais de reordenação, para essa regra não precisar ser lembrada em cada uma.
 */
export function buildReorderItems<T>(
  items: readonly T[],
  getId: (item: T) => string,
): ReorderItem[] {
  return items.map((item, position) => ({ id: getId(item), newIndex: position + 1 }));
}

/**
 * O que há de errado com um conjunto de índices de reordenação, ou `null` se não há nada.
 *
 * É a checagem que o servidor faz ao receber a reordenação - estava copiada em dois handlers de
 * sincronização, com a mesma mensagem escrita duas vezes. Do lado do cliente, é o que
 * `buildReorderItems` garante por construção; o teste de ambos aponta para cá.
 */
export function reorderIndicesProblem(indices: readonly number[]): string | null {
  if (indices.length === 0) return null;
  if (new Set(indices).size !== indices.length) {
    return 'Validation Error: Duplicate newIndex values found in reorder items.';
  }
  if (Math.min(...indices) !== 1 || Math.max(...indices) !== indices.length) {
    return 'Validation Error: New indices must be sequential starting from 1 without gaps.';
  }
  return null;
}
