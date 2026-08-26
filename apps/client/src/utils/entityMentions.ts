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

/** A run of text, carrying a `ref` when it is a mention the caller should make tappable. */
export interface MentionSegment {
  text: string;
  ref?: MentionRef;
}

interface MentionCandidate {
  name: string;
  /** `null` when two active entities share this name - see `buildMentionMatcher`. */
  ref: MentionRef | null;
}

export interface MentionMatcher {
  /** Candidates grouped by their first token, each group ordered longest name first. */
  byFirstToken: Map<string, MentionCandidate[]>;
  /** True when nothing can match; the caller can skip segmenting entirely. */
  isEmpty: boolean;
}

export const EMPTY_MENTION_MATCHER: MentionMatcher = {
  byFirstToken: new Map(),
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
  const byName = new Map<string, MentionCandidate>();

  for (const entity of entities) {
    const name = entity.name?.trim();
    if (!name || name.length < MINIMUM_MENTION_LENGTH) continue;
    if (!firstTokenOf(name)) continue;

    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, { name, ref: { type: entity.type, id: entity.id } });
      continue;
    }
    // A second entity answering to the same name: the app has no basis to choose between them,
    // so it links neither. Silence beats guessing what the writer meant.
    if (existing.ref && existing.ref.id !== entity.id) {
      existing.ref = null;
    }
  }

  const byFirstToken = new Map<string, MentionCandidate[]>();
  for (const candidate of byName.values()) {
    if (!candidate.ref) continue;
    const token = firstTokenOf(candidate.name) as string;
    const group = byFirstToken.get(token);
    if (group) group.push(candidate);
    else byFirstToken.set(token, [candidate]);
  }

  // Longest first, so 'Alice Liddell' is tried before 'Alice'.
  for (const group of byFirstToken.values()) {
    group.sort((a, b) => b.name.length - a.name.length);
  }

  return { byFirstToken, isEmpty: byFirstToken.size === 0 };
}

export interface SplitMentionOptions {
  /** The entity whose screen this text belongs to; it never links to itself. */
  selfId?: string;
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
  if (matcher.isEmpty) return [{ text }];

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
      matched && ref && ref.id !== options.selfId && key !== null && !alreadyLinked.has(key);

    if (usable && matched && ref && key) {
      if (start > plainFrom) segments.push({ text: text.slice(plainFrom, start) });
      segments.push({ text: matched.name, ref });
      alreadyLinked.add(key);
      plainFrom = start + matched.name.length;
      TOKEN_PATTERN.lastIndex = plainFrom;
    }

    token = TOKEN_PATTERN.exec(text);
  }

  if (plainFrom < text.length) segments.push({ text: text.slice(plainFrom) });
  return segments;
}
