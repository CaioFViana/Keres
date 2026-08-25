import { AttributeType } from '../metadata/AttributeType';

export function isEntityAttributeType(type: AttributeType): boolean {
  return type === AttributeType.ENTITY;
}

function normalizeSuggestionListItems(raw: unknown[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of raw) {
    const value = String(entry ?? '').trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(value);
  }
  return items;
}

function parseSuggestionList(stored: string): string[] {
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeSuggestionListItems(parsed);
    }
  } catch {
    // Legacy text / invalid JSON: a single item, so the stored value is not lost.
  }
  const trimmed = stored.trim();
  return trimmed ? [trimmed] : [];
}

/** Expande o valor persistido em itens para colheita de uso (`getValueUsageCounts`). */
export function explodeAttributeUsageValue(
  type: AttributeType | string | null | undefined,
  stored: string,
): string[] {
  if (type === AttributeType.SUGGESTION_LIST) {
    return parseSuggestionList(stored);
  }
  return stored ? [stored] : [];
}

export function joinSuggestionListForDisplay(items: string[] | null | undefined): string | null {
  if (!items?.length) return null;
  return items.join(', ');
}

/**
 * `AttributeValue.value` (and `StorySchemaField.defaultValue`) are always a single text column,
 * decoded according to `AttributeType` - not 4 typed columns. That keeps the table identical in
 * SQLite and Postgres and avoids a data migration if a type is reinterpreted in the future, but it
 * requires that number/boolean are never compared as raw text against an already-typed value
 * (Postgres rejects `text = integer`) - which is why this is the ONLY function that knows how to
 * encode/decode each type; no other point of the code should reimplement it.
 *
 * `SUGGESTION_LIST` is a JSON `string[]` in that same column (`["elf","dwarf"]`). An empty list
 * becomes `null`, like the other empty types.
 */
export function encodeAttributeValue(
  type: AttributeType,
  raw: string | number | boolean | string[] | null | undefined,
): string | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  switch (type) {
    case AttributeType.BOOLEAN:
      return (typeof raw === 'boolean' ? raw : raw === 'true' || raw === '1') ? 'true' : 'false';
    case AttributeType.NUMBER: {
      const numeric = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(numeric) ? String(numeric) : null;
    }
    case AttributeType.ENTITY:
      return String(raw).trim() || null;
    case AttributeType.SUGGESTION_LIST: {
      const items = Array.isArray(raw)
        ? normalizeSuggestionListItems(raw)
        : parseSuggestionList(String(raw));
      return items.length === 0 ? null : JSON.stringify(items);
    }
    default:
      return String(raw);
  }
}

export function decodeAttributeValue(
  type: AttributeType,
  stored: string | null | undefined,
): string | number | boolean | string[] | null {
  if (stored === null || stored === undefined || stored === '') {
    return null;
  }
  switch (type) {
    case AttributeType.BOOLEAN:
      return stored === 'true';
    case AttributeType.NUMBER: {
      const numeric = Number(stored);
      return Number.isFinite(numeric) ? numeric : null;
    }
    case AttributeType.ENTITY:
      return String(stored).trim() || null;
    case AttributeType.SUGGESTION_LIST: {
      const items = parseSuggestionList(stored);
      return items.length === 0 ? null : items;
    }
    default:
      return stored;
  }
}
