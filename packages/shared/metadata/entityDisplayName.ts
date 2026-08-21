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

  const field = ENTITY_SIMPLE_DISPLAY_NAME_FIELD[entityType];
  if (!field) return null;
  return asNonEmptyString(row[field]);
}
