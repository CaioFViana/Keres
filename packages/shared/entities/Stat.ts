/**
 * The stat system: a `Stat` is a measurable axis of the story (Strength, Dexterity),
 * `StatStrength` is a rung on that axis's ladder of values, and `StatRelation` is the value a
 * character (in a mode) has on that axis.
 *
 * It only exists when `Story.statSystem` is on, and the notation (letters or numbers) comes from
 * `Story.statNotation`.
 */
export interface Stat {
  id: string;
  storyId: string;
  name: string;
  /** Only primary stats become radar axes; secondary ones stay in the list alone. */
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
 * A rung on the ladder of values. Each rung's range is `[minValue, next rung's minValue[`, so
 * storing the floor is enough: the whole ladder comes from sorting the rungs by `minValue`.
 *
 * A null `statId` is the story's default ladder, used by every stat that has none of its own.
 */
export interface StatStrength {
  id: string;
  storyId: string;
  /** `null` = the story's default ladder; filled in = a ladder exclusive to that stat. */
  statId: string | null;
  /** Free text shown in letter notation ("F", "SS"). Ignored in numeric notation. */
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
 * A stat's value for a character. A null `modeId` is the normal mode; a mode with no row of its
 * own for a stat inherits the normal mode's value (see `resolveCharacterStats` in the client).
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

/** Ceiling of radar axes - above that the drawing becomes unreadable. */
export const MAX_PRIMARY_STATS = 12;
/** The smallest possible polygon; below that there is no radar to draw. */
export const MIN_PRIMARY_STATS_FOR_CHART = 3;
