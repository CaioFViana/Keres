/** The three parts a detail screen is divided into: what the entity is, what it is linked to, and the rest. */
export type DetailTabKey = 'details' | 'relations' | 'other';

export const DETAIL_TAB_KEYS: readonly DetailTabKey[] = ['details', 'relations', 'other'];

/**
 * The tab a field of the entity lives on, so an occurrence landing (a search result, a backlink)
 * opens the tab that holds the text instead of scrolling a hidden one. Custom attributes and the
 * extra notes are the "other" fields; the schema's own text fields are the details.
 */
export function detailTabForField(field: string): DetailTabKey {
  return field === 'extraNotes' || field.startsWith('custom:') ? 'other' : 'details';
}
