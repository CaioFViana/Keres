/**
 * Sistema de status: um `Stat` é um eixo mensurável da história (Força, Destreza), `StatStrength`
 * é um degrau da escada de valores desse eixo, e `StatRelation` é o valor que um personagem (num
 * modo) tem naquele eixo.
 *
 * Só existe quando `Story.statSystem` está ligado, e a notação (letras ou números) vem de
 * `Story.statNotation`.
 */
export interface Stat {
  id: string;
  storyId: string;
  name: string;
  /** Só os primários viram eixo do gráfico radar; secundários ficam apenas na lista. */
  isPrimary: boolean;
  /** Ordem dos eixos no radar, crescente. */
  order: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}

/**
 * Um degrau da escada de valores. O intervalo de cada degrau é `[minValue, minValue do próximo[`,
 * então guardar o piso basta: a escada inteira sai de ordenar os degraus por `minValue`.
 *
 * `statId` nulo é a escada padrão da história, usada por todo stat que não tiver a própria.
 */
export interface StatStrength {
  id: string;
  storyId: string;
  /** `null` = escada padrão da história; preenchido = escada exclusiva daquele stat. */
  statId: string | null;
  /** Texto livre exibido na notação de letras ("F", "SS"). Ignorado na notação numérica. */
  label: string;
  /** Piso do degrau, nunca negativo e nunca repetido dentro da mesma escada. */
  minValue: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}

/**
 * O valor de um stat para um personagem. `modeId` nulo é o modo normal; um modo que não tem linha
 * própria para um stat herda o valor do modo normal (ver `resolveCharacterStats` no client).
 */
export interface StatRelation {
  id: string;
  storyId: string;
  characterId: string;
  /** `null` = modo normal do personagem. */
  modeId: string | null;
  statId: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}

/** Teto de eixos do radar - acima disso o desenho fica ilegível. */
export const MAX_PRIMARY_STATS = 12;
/** Menor polígono possível; abaixo disso não há radar para desenhar. */
export const MIN_PRIMARY_STATS_FOR_CHART = 3;
