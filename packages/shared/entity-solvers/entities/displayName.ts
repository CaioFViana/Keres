/** A display name can be computed from these columns without joins or host-specific services. */
export interface EntityDisplayName {
  fields: readonly string[];
  getName: (row: Record<string, unknown>) => string | null;
}

export function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function displayField(field: string): EntityDisplayName {
  return { fields: [field], getName: (row) => nonEmptyString(row[field]) };
}

export function displayFirst(...fields: string[]): EntityDisplayName {
  return {
    fields,
    getName: (row) => fields.map((field) => nonEmptyString(row[field])).find(Boolean) ?? null,
  };
}

export function truncateDisplay(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/** Named-list catalog rows store `{ type, name }` as Suggestion.value. */
export function suggestionDisplayValue(value: unknown): string | null {
  const raw = nonEmptyString(value);
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
