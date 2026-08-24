import { buildReorderItems } from '../../src/utils/reorderIndexes';

/**
 * A regra que o servidor aplica em `StorySyncHandler`/`ChapterSyncHandler` antes de aceitar uma
 * reordenação. Reproduzida aqui porque foi exatamente a divergência entre os dois lados - o
 * cliente mandava 0-based - que fazia toda reordenação de cenas virar conflito de sincronização
 * em vez de erro visível.
 */
const serverAccepts = (items: { newIndex: number }[]) => {
  const indexes = items.map((item) => item.newIndex);
  return (
    new Set(indexes).size === indexes.length &&
    Math.min(...indexes) === 1 &&
    Math.max(...indexes) === indexes.length
  );
};

const items = (count: number) =>
  Array.from({ length: count }, (_, position) => ({ id: `item-${position}` }));

describe('buildReorderItems', () => {
  it('numbers the final order from 1, following the list itself', () => {
    expect(buildReorderItems(items(3), (item) => item.id)).toEqual([
      { id: 'item-0', newIndex: 1 },
      { id: 'item-1', newIndex: 2 },
      { id: 'item-2', newIndex: 3 },
    ]);
  });

  it('produces a payload the server accepts, for any list length', () => {
    for (const count of [1, 2, 5, 40]) {
      expect(serverAccepts(buildReorderItems(items(count), (item) => item.id))).toBe(true);
    }
  });

  it('keeps the dragged order, not the previous numbering', () => {
    const dragged = [{ id: 'c' }, { id: 'a' }, { id: 'b' }];

    expect(buildReorderItems(dragged, (item) => item.id).map((item) => item.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('has nothing to send for an empty list', () => {
    expect(buildReorderItems([], (item: { id: string }) => item.id)).toEqual([]);
  });
});
