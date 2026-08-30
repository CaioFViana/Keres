import type { NavigableEntityType } from '../utils/entityNavigation';
import {
  splitTextIntoMentionSegments,
  type MentionMatcher,
  type MentionableEntity,
} from '../utils/entityMentions';

export interface MentionTextSource extends MentionableEntity {
  fields: Record<string, string | null | undefined>;
}

export interface MentionBacklink {
  source: MentionableEntity;
  fields: string[];
  mentionCount: number;
  excerpt: string;
}

export type MentionBacklinkIndex = Map<string, MentionBacklink[]>;

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
      const refs = splitTextIntoMentionSegments(text, matcher, {
        selfId: source.id,
        includeRepeated: true,
      }).flatMap((segment) => (segment.ref ? [segment.ref] : []));
      for (const ref of refs) {
        const key = mentionRefKey(ref.type, ref.id);
        const current = index.get(key) ?? [];
        const excerpt = text.length > 150 ? `${text.slice(0, 147).trimEnd()}…` : text;
        const existing = current.find((entry) => entry.source.id === source.id);
        if (existing) {
          existing.mentionCount += 1;
          if (!existing.fields.includes(field)) existing.fields.push(field);
        } else {
          current.push({
            source: { type: source.type, id: source.id, name: source.name },
            fields: [field],
            mentionCount: 1,
            excerpt,
          });
          index.set(key, current);
        }
      }
    }
  }
  return index;
}
