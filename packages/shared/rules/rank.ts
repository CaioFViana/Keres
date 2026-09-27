/**
 * Positions of arranged rows (a chapter's scenes, a story's chapters, stats and schema fields) as
 * per-row fractional keys.
 *
 * A row's place is its own `rank`, written like any other field of the row: moving one scene
 * rewrites that scene, nothing else. Two devices moving different rows never touch the same row,
 * so there is nothing to dispute; two moving the same row contest one field of one row. Every
 * device and the server sort by `(rank, id)`, so equal ranks (two inserts at the same spot made
 * offline) still land in one order everywhere.
 *
 * The keys are the fractional-indexing scheme (an integer part whose head letter encodes its
 * length, then a fraction with no trailing zero) over base 62 in ASCII order, so a plain string
 * comparison sorts them: JavaScript's `<`, SQLite's BINARY collation. Never `localeCompare`, and
 * never a Postgres `ORDER BY` under a linguistic collation - sort in code there.
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ZERO = DIGITS[0]!;
const INTEGER_ZERO = 'a0';
const SMALLEST_INTEGER = `A${ZERO.repeat(26)}`;

/** Past this length a container is re-ranked evenly instead of growing its keys further. */
export const MAX_RANK_LENGTH = 48;

function integerLength(head: string): number {
  if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 'a'.charCodeAt(0) + 2;
  if (head >= 'A' && head <= 'Z') return 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2;
  throw new Error(`Invalid rank head: ${head}`);
}

function integerPart(key: string): string {
  const length = integerLength(key[0] ?? '');
  if (length > key.length) throw new Error(`Invalid rank: ${key}`);
  return key.slice(0, length);
}

/** Whether a value is a rank this scheme produced (and can place something next to). */
export function isValidRank(key: unknown): key is string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 2 * MAX_RANK_LENGTH) return false;
  if (key === SMALLEST_INTEGER) return false;
  for (const char of key) if (!DIGITS.includes(char)) return false;
  try {
    const integer = integerPart(key);
    return key.slice(integer.length).slice(-1) !== ZERO;
  } catch {
    return false;
  }
}

function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error(`${a} >= ${b}`);
  if (a.slice(-1) === ZERO || (b !== null && b.slice(-1) === ZERO)) {
    throw new Error('Trailing zero in a rank fraction.');
  }
  if (b !== null) {
    let common = 0;
    while ((a[common] ?? ZERO) === b[common]) common += 1;
    if (common > 0) return b.slice(0, common) + midpoint(a.slice(common), b.slice(common));
  }
  const digitA = a ? DIGITS.indexOf(a[0]!) : 0;
  const digitB = b !== null ? DIGITS.indexOf(b[0]!) : DIGITS.length;
  if (digitB - digitA > 1) return DIGITS[Math.round(0.5 * (digitA + digitB))]!;
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[digitA]! + midpoint(a.slice(1), null);
}

function incrementInteger(integer: string): string | null {
  const [head, ...digits] = integer.split('') as [string, ...string[]];
  let carry = true;
  for (let position = digits.length - 1; carry && position >= 0; position -= 1) {
    const next = DIGITS.indexOf(digits[position]!) + 1;
    if (next === DIGITS.length) {
      digits[position] = ZERO;
    } else {
      digits[position] = DIGITS[next]!;
      carry = false;
    }
  }
  if (!carry) return head + digits.join('');
  if (head === 'Z') return `a${ZERO}`;
  if (head === 'z') return null;
  const nextHead = String.fromCharCode(head.charCodeAt(0) + 1);
  if (nextHead > 'a') digits.push(ZERO);
  else digits.pop();
  return nextHead + digits.join('');
}

function decrementInteger(integer: string): string | null {
  const [head, ...digits] = integer.split('') as [string, ...string[]];
  let borrow = true;
  for (let position = digits.length - 1; borrow && position >= 0; position -= 1) {
    const previous = DIGITS.indexOf(digits[position]!) - 1;
    if (previous === -1) {
      digits[position] = DIGITS.slice(-1);
    } else {
      digits[position] = DIGITS[previous]!;
      borrow = false;
    }
  }
  if (!borrow) return head + digits.join('');
  if (head === 'a') return `Z${DIGITS.slice(-1)}`;
  if (head === 'A') return null;
  const previousHead = String.fromCharCode(head.charCodeAt(0) - 1);
  if (previousHead < 'Z') digits.push(DIGITS.slice(-1));
  else digits.pop();
  return previousHead + digits.join('');
}

/** A rank strictly between two (either end open with `null`). Throws unless `a < b`. */
export function rankBetween(a: string | null, b: string | null): string {
  if (a !== null && !isValidRank(a)) throw new Error(`Invalid rank: ${a}`);
  if (b !== null && !isValidRank(b)) throw new Error(`Invalid rank: ${b}`);
  if (a !== null && b !== null && a >= b) throw new Error(`${a} >= ${b}`);
  if (a === null) {
    if (b === null) return INTEGER_ZERO;
    const integerB = integerPart(b);
    const fractionB = b.slice(integerB.length);
    if (integerB === SMALLEST_INTEGER) return integerB + midpoint('', fractionB);
    if (integerB < b) return integerB;
    const decremented = decrementInteger(integerB);
    if (decremented === null) throw new Error('Cannot rank below the smallest key.');
    return decremented;
  }
  if (b === null) {
    const integerA = integerPart(a);
    const incremented = incrementInteger(integerA);
    return incremented === null ? integerA + midpoint(a.slice(integerA.length), null) : incremented;
  }
  const integerA = integerPart(a);
  const fractionA = a.slice(integerA.length);
  const integerB = integerPart(b);
  const fractionB = b.slice(integerB.length);
  if (integerA === integerB) return integerA + midpoint(fractionA, fractionB);
  const incremented = incrementInteger(integerA);
  if (incremented === null) throw new Error('Cannot rank above the largest key.');
  if (incremented < b) return incremented;
  return integerA + midpoint(fractionA, null);
}

/** `count` ascending ranks strictly between two, spread so later inserts stay short. */
export function ranksBetween(a: string | null, b: string | null, count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return [rankBetween(a, b)];
  if (b === null) {
    const ranks = [rankBetween(a, null)];
    while (ranks.length < count) ranks.push(rankBetween(ranks.at(-1)!, null));
    return ranks;
  }
  if (a === null) {
    const ranks = [rankBetween(null, b)];
    while (ranks.length < count) ranks.push(rankBetween(null, ranks.at(-1)!));
    return ranks.reverse();
  }
  const middle = Math.floor(count / 2);
  const pivot = rankBetween(a, b);
  return [...ranksBetween(a, pivot, middle), pivot, ...ranksBetween(pivot, b, count - middle - 1)];
}

/**
 * The rank of an integer position (1-based): an order-preserving, deterministic key - every device
 * and the server derive the same one from the same position. For rows that state a position and no
 * rank (a story package, a create that says where it goes). Integer keys, so they compare correctly
 * with anything ranked later.
 */
export function rankAtPosition(position: number): string {
  let remaining = Number.isFinite(position) ? Math.max(0, Math.trunc(position)) : 0;
  let digits = 1;
  let span = DIGITS.length;
  while (remaining >= span) {
    remaining -= span;
    digits += 1;
    span *= DIGITS.length;
  }
  let encoded = '';
  for (let place = 0; place < digits; place += 1) {
    encoded = DIGITS[remaining % DIGITS.length]! + encoded;
    remaining = Math.floor(remaining / DIGITS.length);
  }
  return String.fromCharCode('a'.charCodeAt(0) + digits - 1) + encoded;
}

/** The one order of arranged rows everywhere: by rank, then by id. */
export function compareRanked(
  left: { rank: string; id: string },
  right: { rank: string; id: string },
): number {
  if (left.rank !== right.rank) return left.rank < right.rank ? -1 : 1;
  if (left.id !== right.id) return left.id < right.id ? -1 : 1;
  return 0;
}

/**
 * The rank rewrites that put a container's rows in `desiredIds` order, touching as few rows as
 * possible: the longest run already in order keeps its ranks and only the others move between
 * their new neighbours. Rows not named in `desiredIds` keep their relative order after the named
 * ones; ids not among `rows` are placed as new rows (a create, which has no rank yet). Returns
 * `id -> new rank` for every row whose rank changes. When keys would grow past
 * `MAX_RANK_LENGTH`, the whole container is re-ranked evenly instead.
 */
export function planRankChanges(
  rows: readonly { id: string; rank: string }[],
  desiredIds: readonly string[],
): Map<string, string> {
  const current = [...rows].sort(compareRanked);
  const position = new Map(current.map((row, index) => [row.id, index]));
  const rankOf = new Map(current.map((row) => [row.id, row.rank]));
  const named = new Set<string>();
  const desired: string[] = [];
  for (const id of desiredIds) {
    if (named.has(id)) continue;
    named.add(id);
    desired.push(id);
  }
  for (const row of current) if (!named.has(row.id)) desired.push(row.id);

  // Longest strictly increasing run of current positions, over rows holding a usable rank.
  const candidates = desired.map((id) => {
    const rank = rankOf.get(id);
    return rank !== undefined && isValidRank(rank) ? position.get(id)! : -1;
  });
  const kept = longestIncreasing(candidates);

  // Kept ranks must strictly increase: a tie (equal ranks told apart by id) leaves no room
  // between them, so the later one moves too.
  let previous: string | null = null;
  for (let index = 0; index < desired.length; index += 1) {
    if (!kept.has(index)) continue;
    const rank = rankOf.get(desired[index]!)!;
    if (previous !== null && rank <= previous) {
      kept.delete(index);
      continue;
    }
    previous = rank;
  }

  const assigned = new Map<string, string>();
  let lower: string | null = null;
  let run: string[] = [];
  const flush = (upper: string | null) => {
    if (run.length === 0) return;
    const ranks = ranksBetween(lower, upper, run.length);
    run.forEach((id, index) => assigned.set(id, ranks[index]!));
    run = [];
  };
  for (let index = 0; index < desired.length; index += 1) {
    const id = desired[index]!;
    if (kept.has(index)) {
      const rank = rankOf.get(id)!;
      flush(rank);
      lower = rank;
    } else {
      run.push(id);
    }
  }
  flush(null);

  if ([...assigned.values()].some((rank) => rank.length > MAX_RANK_LENGTH)) {
    const even = ranksBetween(null, null, desired.length);
    assigned.clear();
    desired.forEach((id, index) => assigned.set(id, even[index]!));
  }
  for (const [id, rank] of assigned) if (rankOf.get(id) === rank) assigned.delete(id);
  return assigned;
}

/** Indices (into `values`) of one longest strictly increasing subsequence, ignoring negatives. */
function longestIncreasing(values: readonly number[]): Set<number> {
  const tails: number[] = [];
  const previous: number[] = new Array(values.length).fill(-1);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (value < 0) continue;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (values[tails[middle]!]! < value) low = middle + 1;
      else high = middle;
    }
    if (low > 0) previous[index] = tails[low - 1]!;
    tails[low] = index;
  }
  const result = new Set<number>();
  let cursor = tails.length > 0 ? tails[tails.length - 1]! : -1;
  while (cursor !== -1) {
    result.add(cursor);
    cursor = previous[cursor]!;
  }
  return result;
}

/**
 * Where an arranged row sits and within what: its derived position field (`index` 1-based for
 * scenes and chapters, `order` 0-based for stats and schema fields) and the fields that, with the
 * story, name its container. The position is derived from ranks - it is never written as a field
 * of its own, never synchronized, and never moves a version.
 */
export interface ArrangedEntity {
  positionField: 'index' | 'order';
  /** The position of the first row: 1 for `index`, 0 for `order`. */
  base: 0 | 1;
  containerFields: readonly string[];
}

export const ARRANGED: Readonly<Record<string, ArrangedEntity>> = {
  Scene: { positionField: 'index', base: 1, containerFields: ['chapterId'] },
  Chapter: { positionField: 'index', base: 1, containerFields: ['type'] },
  Stat: { positionField: 'order', base: 0, containerFields: [] },
  StorySchemaField: { positionField: 'order', base: 0, containerFields: ['entityType'] },
};

/** `rankAtPosition` for a row of this entity, from a position in the entity's own base. */
export function rankAtPositionOf(entityType: string, position: number): string {
  const arranged = ARRANGED[entityType];
  return rankAtPosition(arranged && arranged.base === 0 ? position + 1 : position);
}

/**
 * Derived positions for a set of rows of one entity: live rows grouped by container, sorted by
 * `(rank, id)`, numbered from the entity's base; a deleted row holds no place, which reads as
 * `base - 1` everywhere. Returns `id -> position` for every row.
 */
export function derivePositions<
  T extends { id: string; rank: string; isDeleted: boolean } & Record<string, unknown>,
>(entityType: string, rows: readonly T[]): Map<string, number> {
  const arranged = ARRANGED[entityType];
  const positions = new Map<string, number>();
  if (!arranged) return positions;
  const containers = new Map<string, T[]>();
  for (const row of rows) {
    if (row.isDeleted) {
      positions.set(row.id, arranged.base - 1);
      continue;
    }
    const key = JSON.stringify(arranged.containerFields.map((field) => row[field] ?? null));
    const bucket = containers.get(key);
    if (bucket) bucket.push(row);
    else containers.set(key, [row]);
  }
  for (const bucket of containers.values()) {
    bucket.sort(compareRanked);
    bucket.forEach((row, index) => positions.set(row.id, index + arranged.base));
  }
  return positions;
}
