/** Shared naming rules for saved suggestion catalogues and user-defined suggestion lists. */
const CUSTOM_ATTRIBUTE_TYPE_PREFIX = 'custom:';
export const LIST_CATALOG_TYPE = 'list_catalog';
export const NAMED_LIST_TYPE_PREFIX = 'list_';
export const WORLD_PIECE_TYPE_PREFIX = 'world_piece_type:';
export const WORLD_PIECE_CATEGORY_TYPE = 'world_piece_category';

/** A World Piece type catalogue is deliberately scoped by its fixed Section. */
export function isWorldPieceSuggestionType(type: string): boolean {
  return type.startsWith(WORLD_PIECE_TYPE_PREFIX) || type === WORLD_PIECE_CATEGORY_TYPE;
}

export function customAttributeSuggestionType(fieldId: string): string {
  return `${CUSTOM_ATTRIBUTE_TYPE_PREFIX}${fieldId}`;
}

export function isCustomAttributeSuggestionType(type: string): boolean {
  return type.startsWith(CUSTOM_ATTRIBUTE_TYPE_PREFIX);
}

export function suggestionFieldId(type: string): string | null {
  return isCustomAttributeSuggestionType(type)
    ? type.slice(CUSTOM_ATTRIBUTE_TYPE_PREFIX.length)
    : null;
}

export function isNamedListType(type: string): boolean {
  return type.startsWith(NAMED_LIST_TYPE_PREFIX) && type !== LIST_CATALOG_TYPE;
}

export function namedListType(id: string, slug: string): string {
  return `${NAMED_LIST_TYPE_PREFIX}${id}_${slug}`;
}

/** ULID is 26 Crockford base32 chars. Display key is the slug after `list_<ulid>_`. */
const NAMED_LIST_ULID_LENGTH = 26;

export function namedListDisplayKey(type: string): string {
  if (!isNamedListType(type)) return type;
  const rest = type.slice(NAMED_LIST_TYPE_PREFIX.length);
  if (rest.length > NAMED_LIST_ULID_LENGTH + 1 && rest[NAMED_LIST_ULID_LENGTH] === '_') {
    return rest.slice(NAMED_LIST_ULID_LENGTH + 1);
  }
  return type;
}

export type NamedSuggestionList = { type: string; name: string };

export function parseNamedListCatalogValue(value: string): NamedSuggestionList | null {
  try {
    const parsed = JSON.parse(value) as { type?: unknown; name?: unknown };
    if (
      typeof parsed.type === 'string' &&
      isNamedListType(parsed.type) &&
      typeof parsed.name === 'string' &&
      parsed.name.trim()
    ) {
      return { type: parsed.type, name: parsed.name.trim() };
    }
  } catch {
    return null;
  }
  return null;
}
