/**
 * A regra de reordenação (índices 1..N contíguos) mora em `@keres/shared`: o servidor recusa
 * qualquer outra coisa, e a recusa dele e a construção daqui têm que dizer a mesma coisa.
 * Reexportado aqui para os imports do app não precisarem mudar.
 */
export { buildReorderItems, reorderIndicesProblem, type ReorderItem } from '@keres/shared';
