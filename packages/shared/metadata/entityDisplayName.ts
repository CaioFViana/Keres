/**
 * Per-type primary display field, aligned with
 * `apps/client/src/services/EntityNameBatchResolver.ts` (NAME_COLUMN_BY_ENTITY).
 * Gallery is special-cased in `getSimpleDisplayName` (title || fileName).
 */
export const ENTITY_SIMPLE_DISPLAY_NAME_FIELD: Readonly<Record<string, string>> = {
  Character: 'name',
  Location: 'name',
  Item: 'name',
  Tag: 'name',
  Chapter: 'name',
  Scene: 'name',
  StorySchemaField: 'name',
  Stat: 'name',
  Mode: 'name',
  StatStrength: 'label',
  Story: 'title',
  Note: 'title',
  WorldRule: 'title',
  Choice: 'text',
  Suggestion: 'value',
  AttributeValue: 'value',
};

const COMMENT_SNIPPET_MAX = 80;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/**
 * Named-list catalog rows store `{ type, name }` as Suggestion.value.
 * Show only the human name; leave ordinary suggestion values untouched.
 */
export function suggestionDisplayValue(value: unknown): string | null {
  const raw = asNonEmptyString(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { type?: unknown; name?: unknown };
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.name === 'string' &&
      parsed.name.trim() &&
      typeof parsed.type === 'string' &&
      parsed.type.startsWith('list_') &&
      parsed.type !== 'list_catalog'
    ) {
      return parsed.name.trim();
    }
  } catch {
    // Plain suggestion text, not catalog JSON.
  }
  return raw;
}

/**
 * Best-effort display name from the entity's own row (no joins).
 * Does **not** prefer Character.title over Character.name — that mismatch with the client
 * was the old recovery bug.
 */
export function getSimpleDisplayName(
  entityType: string,
  row: Record<string, unknown>,
): string | null {
  if (entityType === 'Gallery') {
    return asNonEmptyString(row.title) ?? asNonEmptyString(row.fileName);
  }

  if (entityType === 'Comment') {
    const text = asNonEmptyString(row.commentText);
    return text ? truncate(text, COMMENT_SNIPPET_MAX) : null;
  }

  if (entityType === 'Effect') {
    return asNonEmptyString(row.triggerName) ?? asNonEmptyString(row.effectType);
  }

  if (entityType === 'Suggestion') {
    return suggestionDisplayValue(row.value);
  }

  const field = ENTITY_SIMPLE_DISPLAY_NAME_FIELD[entityType];
  if (!field) return null;
  return asNonEmptyString(row[field]);
}
