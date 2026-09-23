import type { NavigableEntityType } from './entityNavigation';

/**
 * Finds mentions of a story's entities inside its own free text, so a detail screen can render
 * them as links (see `autoLinkMentions` on the Story).
 *
 * The feature is deliberately **automatic**: there is no `[[syntax]]` for the writer to learn and
 * no way to mark a single mention. That means the app decides what counts as a mention, and the
 * rules below are the whole feature. They are tuned to be *restrained* rather than exhaustive:
 * missing a link costs nothing, while a wrong link on every page is why a feature gets turned off.
 *
 * Nothing here writes. A mention is rendered and navigated, never persisted - `SeeAlsoRelation`
 * stays what it is, a link the writer made on purpose.
 */

/** A word character for boundary purposes - what may *not* sit against a match's edge. */
const WORD_CHARACTER = /[\p{L}\p{N}_]/u;

/** Runs of letters and digits; used to find the positions a name could start at. */
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

/**
 * Names shorter than this never link. Two-character names ('Al', 'Ed') appear inside ordinary
 * words often enough that the boundary check alone is not protection.
 */
export const MINIMUM_MENTION_LENGTH = 3;

export interface MentionableEntity {
  type: NavigableEntityType;
  id: string;
  name: string;
}

export interface MentionRef {
  type: NavigableEntityType;
  id: string;
}

/**
 * A run of text, carrying a `ref` when it is a mention the caller should make tappable.
 * `start` is the run's UTF-16 offset in the scanned text, so indexers can frame the
 * occurrence (a centered excerpt) without re-scanning for it.
 */
export interface MentionSegment {
  text: string;
  start: number;
  ref?: MentionRef;
}

interface MentionCandidate {
  name: string;
  ref: MentionRef;
}

/** A name two or more active entities answer to: linked by neither, suggested for both. */
export interface AmbiguousMentionName {
  name: string;
  entities: MentionableEntity[];
}

export interface MentionMatcher {
  /** Candidates grouped by their first token, each group ordered longest name first. */
  byFirstToken: Map<string, MentionCandidate[]>;
  /**
   * Names the matcher stays silent on, with every claimant. Matching ignores them;
   * the ambiguity index turns their occurrences into resolve-in-one-tap suggestions.
   */
  ambiguousNames: AmbiguousMentionName[];
  /** True when nothing can match; the caller can skip segmenting entirely. */
  isEmpty: boolean;
}

export const EMPTY_MENTION_MATCHER: MentionMatcher = {
  byFirstToken: new Map(),
  ambiguousNames: [],
  isEmpty: true,
};

function firstTokenOf(name: string): string | null {
  TOKEN_PATTERN.lastIndex = 0;
  return TOKEN_PATTERN.exec(name)?.[0] ?? null;
}

function isWordCharacterAt(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return false;
  return WORD_CHARACTER.test(text[index] as string);
}

/**
 * Indexes the story's entities by the first token of their name.
 *
 * Grouping by first token is what keeps matching O(text) instead of O(names x text): scanning a
 * field looks each of its words up once, and only a hit pays the cost of comparing a full name.
 * It also means a name may contain any punctuation ('Jean-Luc Picard', "Al'Thor") without the
 * matcher having to model it - the comparison is against the original text, not a rebuilt token.
 *
 * Pass **active entities only**; a deleted one simply stops linking, with no extra bookkeeping.
 */
export function buildMentionMatcher(entities: MentionableEntity[]): MentionMatcher {
  const byName = new Map<string, { name: string; entities: MentionableEntity[] }>();

  for (const entity of entities) {
    const name = entity.name?.trim();
    if (!name || name.length < MINIMUM_MENTION_LENGTH) continue;
    if (!firstTokenOf(name)) continue;

    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, { name, entities: [{ type: entity.type, id: entity.id, name }] });
      continue;
    }
    // The same entity listed twice is not ambiguity.
    if (!existing.entities.some((candidate) => candidate.id === entity.id)) {
      existing.entities.push({ type: entity.type, id: entity.id, name });
    }
  }

  const byFirstToken = new Map<string, MentionCandidate[]>();
  const ambiguousNames: AmbiguousMentionName[] = [];
  for (const { name, entities: claimants } of byName.values()) {
    // A second entity answering to the same name: the app has no basis to choose between them,
    // so it links neither. Silence beats guessing what the writer meant - but the silence is
    // recorded, so the ambiguity index can ask the writer to resolve it.
    if (claimants.length > 1) {
      ambiguousNames.push({ name, entities: claimants });
      continue;
    }
    const [single] = claimants as [MentionableEntity];
    const candidate: MentionCandidate = { name, ref: { type: single.type, id: single.id } };
    const token = firstTokenOf(candidate.name) as string;
    const group = byFirstToken.get(token);
    if (group) group.push(candidate);
    else byFirstToken.set(token, [candidate]);
  }

  // Longest first, so 'Alice Liddell' is tried before 'Alice'.
  for (const group of byFirstToken.values()) {
    group.sort((a, b) => b.name.length - a.name.length);
  }

  return { byFirstToken, ambiguousNames, isEmpty: byFirstToken.size === 0 };
}

export interface SplitMentionOptions {
  /** The entity whose screen this text belongs to; it never links to itself. */
  selfId?: string;
  /** Backlink indexing counts every valid occurrence; rendered text still links only the first. */
  includeRepeated?: boolean;
}

/**
 * Splits `text` into plain runs and mention runs.
 *
 * Three rules beyond plain matching, each removing a class of false positive that the writer
 * would have no way to correct:
 *
 * - **Case-sensitive.** Proper nouns are capitalised in both Portuguese and English, and the
 *   common words that collide with them are not: an Item named `Espada` links `Espada` and leaves
 *   `espada` alone. This one rule removes most of the noise, and costs nothing.
 * - **Unicode boundaries.** JavaScript's `\b` is ASCII-only, so it mishandles every accented name
 *   the app is full of; the edges are checked against `\p{L}\p{N}_` instead.
 * - **First occurrence per field.** A biography naming `Alice` forty times would otherwise become
 *   forty blue words. The first mention of each entity links and the rest render plain - the
 *   convention encyclopedias use, and it matters more here because the writer cannot hand-tune it.
 */
export function splitTextIntoMentionSegments(
  text: string | null | undefined,
  matcher: MentionMatcher,
  options: SplitMentionOptions = {},
): MentionSegment[] {
  if (!text) return [];
  if (matcher.isEmpty) return [{ text, start: 0 }];

  const segments: MentionSegment[] = [];
  const alreadyLinked = new Set<string>();
  let plainFrom = 0;

  TOKEN_PATTERN.lastIndex = 0;
  let token = TOKEN_PATTERN.exec(text);

  while (token) {
    const start = token.index;
    // A token that starts inside an earlier match is not a candidate.
    if (start < plainFrom) {
      token = TOKEN_PATTERN.exec(text);
      continue;
    }

    const group = matcher.byFirstToken.get(token[0]);
    const matched = group?.find(
      (candidate) =>
        text.startsWith(candidate.name, start) &&
        !isWordCharacterAt(text, start + candidate.name.length),
    );

    const ref = matched?.ref;
    const key = ref ? `${ref.type}:${ref.id}` : null;
    const usable =
      matched &&
      ref &&
      ref.id !== options.selfId &&
      key !== null &&
      (options.includeRepeated === true || !alreadyLinked.has(key));

    if (usable && matched && ref && key) {
      if (start > plainFrom)
        segments.push({ text: text.slice(plainFrom, start), start: plainFrom });
      segments.push({ text: matched.name, start, ref });
      alreadyLinked.add(key);
      plainFrom = start + matched.name.length;
      TOKEN_PATTERN.lastIndex = plainFrom;
    }

    token = TOKEN_PATTERN.exec(text);
  }

  if (plainFrom < text.length) segments.push({ text: text.slice(plainFrom), start: plainFrom });
  return segments;
}

export interface AmbiguousNameOccurrence {
  name: string;
  start: number;
  length: number;
  entities: MentionableEntity[];
}

/**
 * Every occurrence of the matcher's ambiguous names in `text`, under the same rules as
 * linked mentions (case-sensitive, Unicode boundaries, longest name first) but without
 * the first-occurrence-per-entity limit: the ambiguity index counts and frames each one.
 * The caller filters out the text's own entity from `entities` when it cannot link to
 * itself.
 */
export function findAmbiguousNameOccurrences(
  text: string | null | undefined,
  matcher: MentionMatcher,
): AmbiguousNameOccurrence[] {
  if (!text || matcher.ambiguousNames.length === 0) return [];
  const byFirstToken = new Map<string, AmbiguousMentionName[]>();
  for (const ambiguous of matcher.ambiguousNames) {
    const token = firstTokenOf(ambiguous.name);
    if (!token) continue;
    const group = byFirstToken.get(token);
    if (group) group.push(ambiguous);
    else byFirstToken.set(token, [ambiguous]);
  }
  for (const group of byFirstToken.values()) {
    group.sort((a, b) => b.name.length - a.name.length);
  }

  const occurrences: AmbiguousNameOccurrence[] = [];
  let consumedUntil = 0;
  TOKEN_PATTERN.lastIndex = 0;
  let token = TOKEN_PATTERN.exec(text);
  while (token) {
    const start = token.index;
    if (start < consumedUntil) {
      token = TOKEN_PATTERN.exec(text);
      continue;
    }
    const group = byFirstToken.get(token[0]);
    const matched = group?.find(
      (candidate) =>
        text.startsWith(candidate.name, start) &&
        !isWordCharacterAt(text, start + candidate.name.length),
    );
    if (matched) {
      occurrences.push({
        name: matched.name,
        start,
        length: matched.name.length,
        entities: matched.entities,
      });
      consumedUntil = start + matched.name.length;
      TOKEN_PATTERN.lastIndex = consumedUntil;
    }
    token = TOKEN_PATTERN.exec(text);
  }
  return occurrences;
}
