/** Uma ponta de um par: o tipo da entidade e o id dela. */
export interface EntityPairRef {
  type: string;
  id: string;
}

/**
 * Ordenação canônica de um par não-ordenado.
 *
 * Um vínculo "Veja também" entre A e B é o mesmo vínculo entre B e A, mas o banco guarda duas
 * colunas. Sem uma ordem fixa, o mesmo par entra duas vezes - a checagem de duplicidade procura
 * na ordem em que chegou e não encontra o registro guardado na ordem contrária. Cliente e
 * servidor precisam ordenar igual, e cada um tinha a sua cópia da função.
 */
export function sortEntityPair(a: EntityPairRef, b: EntityPairRef): [EntityPairRef, EntityPairRef] {
  return `${a.type}:${a.id}` <= `${b.type}:${b.id}` ? [a, b] : [b, a];
}

export function isSameEntity(a: EntityPairRef, b: EntityPairRef): boolean {
  return a.type === b.type && a.id === b.id;
}

/** Mensagem única para as duas pontas recusarem o vínculo de uma entidade com ela mesma. */
export const SELF_LINK_ERROR = 'Validation Error: an entity cannot be See-Also-linked to itself.';
