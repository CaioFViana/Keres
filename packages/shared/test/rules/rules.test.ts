import { describe, expect, it } from 'vitest';
import { isSameEntity, SELF_LINK_ERROR, sortEntityPair } from '../../rules/entityPair';
import { scenesToUnflag } from '../../rules/linearStoryScenes';
import { buildReorderItems, reorderIndicesProblem } from '../../rules/reorderIndices';
import { ownerOnlyFieldsIn, STORY_OWNER_ONLY_FIELDS } from '../../rules/storyOwnerFields';

/**
 * As regras que valem nos dois lados da sincronização. Cada uma delas já existiu escrita duas
 * vezes - cliente e servidor - e o teste vive aqui justamente para haver um lugar só onde a
 * regra é afirmada.
 */
describe('cenas de início e fim numa história linear', () => {
  it('não desmarca nada quando já há no máximo uma de cada', () => {
    expect(
      scenesToUnflag([
        { id: 'a', isStart: true, isFinish: false },
        { id: 'b', isStart: false, isFinish: false },
        { id: 'c', isStart: false, isFinish: true },
      ]),
    ).toEqual({ start: [], finish: [] });
  });

  it('mantém a primeira e desmarca as repetidas', () => {
    expect(
      scenesToUnflag([
        { id: 'a', isStart: true },
        { id: 'b', isStart: true },
        { id: 'c', isStart: true },
      ]).start,
    ).toEqual(['b', 'c']);
  });

  it('trata início e fim de forma independente', () => {
    const { start, finish } = scenesToUnflag([
      { id: 'a', isStart: true, isFinish: true },
      { id: 'b', isStart: true, isFinish: false },
      { id: 'c', isStart: false, isFinish: true },
    ]);

    expect(start).toEqual(['b']);
    expect(finish).toEqual(['c']);
  });

  it('aceita cena sem as marcas definidas', () => {
    expect(scenesToUnflag([{ id: 'a' }, { id: 'b' }])).toEqual({ start: [], finish: [] });
  });
});

describe('índices de reordenação', () => {
  it('aceita 1..N contíguo', () => {
    expect(reorderIndicesProblem([1, 2, 3])).toBeNull();
    expect(reorderIndicesProblem([3, 1, 2])).toBeNull();
  });

  it('recusa índice repetido', () => {
    expect(reorderIndicesProblem([1, 2, 2])).toContain('Duplicate');
  });

  it('recusa lista que não começa em 1', () => {
    expect(reorderIndicesProblem([0, 1, 2])).toContain('sequential');
    expect(reorderIndicesProblem([2, 3, 4])).toContain('sequential');
  });

  it('recusa buraco no meio', () => {
    expect(reorderIndicesProblem([1, 2, 4, 5])).toContain('sequential');
  });

  it('não tem o que reclamar de lista vazia', () => {
    expect(reorderIndicesProblem([])).toBeNull();
  });

  /** O produtor e o validador têm que concordar: é o ponto de existir os dois aqui. */
  it('produz uma lista que o próprio validador aceita', () => {
    const items = buildReorderItems(['x', 'y', 'z'], (id) => id);

    expect(items).toEqual([
      { id: 'x', newIndex: 1 },
      { id: 'y', newIndex: 2 },
      { id: 'z', newIndex: 3 },
    ]);
    expect(reorderIndicesProblem(items.map((item) => item.newIndex))).toBeNull();
  });
});

describe('par não-ordenado de entidades', () => {
  it('ordena o par sempre do mesmo jeito, venha na ordem que vier', () => {
    const a = { type: 'Character', id: '2' };
    const b = { type: 'Location', id: '1' };

    expect(sortEntityPair(a, b)).toEqual(sortEntityPair(b, a));
  });

  it('desempata pelo id quando o tipo é o mesmo', () => {
    const [first] = sortEntityPair({ type: 'Note', id: 'b' }, { type: 'Note', id: 'a' });

    expect(first.id).toBe('a');
  });

  it('reconhece a entidade ligada a ela mesma', () => {
    expect(isSameEntity({ type: 'Note', id: 'a' }, { type: 'Note', id: 'a' })).toBe(true);
    expect(isSameEntity({ type: 'Note', id: 'a' }, { type: 'Note', id: 'b' })).toBe(false);
    expect(isSameEntity({ type: 'Note', id: 'a' }, { type: 'Item', id: 'a' })).toBe(false);
    expect(SELF_LINK_ERROR).toContain('itself');
  });
});

describe('campos que só o dono altera', () => {
  it('inclui identidade e política da história', () => {
    expect([...STORY_OWNER_ONLY_FIELDS]).toEqual([
      'id',
      'userId',
      'type',
      'favoriteBehavior',
      'allowReaderComments',
    ]);
  });

  it('aponta os campos restritos presentes numa alteração', () => {
    expect(ownerOnlyFieldsIn({ title: 'x', type: 'linear' })).toEqual(['type']);
    expect(ownerOnlyFieldsIn({ title: 'x' })).toEqual([]);
    expect(ownerOnlyFieldsIn(undefined)).toEqual([]);
  });

  /** `undefined` é "não mexeu"; `null` é uma alteração e tem que ser barrada. */
  it('considera null uma tentativa de alteração', () => {
    expect(ownerOnlyFieldsIn({ favoriteBehavior: null })).toEqual(['favoriteBehavior']);
  });
});
