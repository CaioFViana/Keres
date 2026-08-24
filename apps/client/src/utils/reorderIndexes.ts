export interface ReorderItem {
  id: string;
  newIndex: number;
}

/**
 * A ordem final de uma lista arrastada, no formato que a sincronização espera: `newIndex`
 * **1..N contíguo**.
 *
 * A base não é escolha de estilo. O servidor recusa uma reordenação cujo menor índice não seja
 * 1 ou que não termine em N (`StorySyncHandler`/`ChapterSyncHandler`), e a recusa não aparece
 * como erro na tela: vira um conflito de sincronização, com a nova ordem ficando só no
 * aparelho. Uma função só, usada por todas as modais de reordenação, para essa regra não
 * precisar ser lembrada em cada uma.
 */
export function buildReorderItems<T>(items: T[], getId: (item: T) => string): ReorderItem[] {
  return items.map((item, position) => ({ id: getId(item), newIndex: position + 1 }));
}
