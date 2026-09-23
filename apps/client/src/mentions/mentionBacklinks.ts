import { excerptAroundMatch } from '@keres/shared';
import type { NavigableEntityType } from '../utils/entityNavigation';
import {
  findAmbiguousNameOccurrences,
  splitTextIntoMentionSegments,
  type MentionableEntity,
  type MentionMatcher,
} from '../utils/entityMentions';

export interface MentionTextSource extends MentionableEntity {
  fields: Record<string, string | null | undefined>;
}

/** One field's share of a backlink: how often it mentions the target, framed on the first hit. */
export interface MentionBacklinkOccurrence {
  field: string;
  mentionCount: number;
  excerpt: string;
}

export interface MentionBacklink {
  source: MentionableEntity;
  fields: string[];
  mentionCount: number;
  excerpt: string;
  occurrences: MentionBacklinkOccurrence[];
}

export type MentionBacklinkIndex = Map<string, MentionBacklink[]>;

/**
 * An ambiguous name used in one source's field: the derived suggestion the writer resolves
 * by linking one claimant in "See also". `candidates` never holds the source itself.
 */
export interface AmbiguousMention {
  name: string;
  field: string;
  mentionCount: number;
  excerpt: string;
  candidates: MentionableEntity[];
}

export type AmbiguousMentionIndex = Map<string, AmbiguousMention[]>;

export const mentionRefKey = (type: NavigableEntityType, id: string) => `${type}:${id}`;

/** Pure index builder: backlinks use exactly the same restrained rules as rendered auto-links. */
export function buildMentionBacklinkIndex(
  sources: MentionTextSource[],
  matcher: MentionMatcher,
): MentionBacklinkIndex {
  const index: MentionBacklinkIndex = new Map();
  for (const source of sources) {
    for (const [field, text] of Object.entries(source.fields)) {
      if (!text?.trim()) continue;
      const hits = splitTextIntoMentionSegments(text, matcher, {
        selfId: source.id,
        includeRepeated: true,
      }).flatMap((segment) =>
        segment.ref
          ? [{ ref: segment.ref, start: segment.start, length: segment.text.length }]
          : [],
      );
      for (const hit of hits) {
        const key = mentionRefKey(hit.ref.type, hit.ref.id);
        const current = index.get(key) ?? [];
        const excerpt = excerptAroundMatch(text, { start: hit.start, length: hit.length });
        const existing = current.find((entry) => entry.source.id === source.id);
        if (existing) {
          existing.mentionCount += 1;
          if (!existing.fields.includes(field)) existing.fields.push(field);
          const occurrence = existing.occurrences.find((entry) => entry.field === field);
          if (occurrence) {
            occurrence.mentionCount += 1;
          } else {
            existing.occurrences.push({ field, mentionCount: 1, excerpt });
          }
        } else {
          current.push({
            source: { type: source.type, id: source.id, name: source.name },
            fields: [field],
            mentionCount: 1,
            excerpt,
            occurrences: [{ field, mentionCount: 1, excerpt }],
          });
          index.set(key, current);
        }
      }
    }
  }
  return index;
}

/**
 * Pure ambiguity builder: every ambiguous-name occurrence in every source, keyed by the
 * source. The matcher links none of these by design; this index is what surfaces them as
 * resolve-in-one-tap "See also" suggestions instead of staying silent.
 */
export function buildAmbiguousMentionIndex(
  sources: MentionTextSource[],
  matcher: MentionMatcher,
): AmbiguousMentionIndex {
  const index: AmbiguousMentionIndex = new Map();
  if (matcher.ambiguousNames.length === 0) return index;
  for (const source of sources) {
    for (const [field, text] of Object.entries(source.fields)) {
      if (!text?.trim()) continue;
      const hits = findAmbiguousNameOccurrences(text, matcher);
      for (const hit of hits) {
        const candidates = hit.entities.filter((entity) => entity.id !== source.id);
        if (candidates.length === 0) continue;
        const key = mentionRefKey(source.type, source.id);
        const current = index.get(key) ?? [];
        const existing = current.find((entry) => entry.name === hit.name && entry.field === field);
        if (existing) {
          existing.mentionCount += 1;
        } else {
          current.push({
            name: hit.name,
            field,
            mentionCount: 1,
            excerpt: excerptAroundMatch(text, { start: hit.start, length: hit.length }),
            candidates,
          });
          index.set(key, current);
        }
      }
    }
  }
  return index;
}
