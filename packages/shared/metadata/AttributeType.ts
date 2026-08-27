/** Tipos suportados por um atributo customizado de Story Schema. */
export enum AttributeType {
  TEXT = 'text',
  LONG_TEXT = 'long_text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  /**
   * A date in the story's own calendar, stored as an integer day number.
   *
   * Beside `DATE` rather than replacing it: `DATE` holds a canonical `YYYY-MM-DD` validated by
   * round-trip, which a calendar of thirteen 28-day months breaks outright - and historical fiction
   * legitimately wants the real calendar. Storing a day number rather than a formatted string is
   * also what lets a calendar be edited afterwards without invalidating anything.
   */
  STORY_DATE = 'story_date',
  SUGGESTION = 'suggestion',
  SUGGESTION_LIST = 'suggestion_list',
  ENTITY = 'entity',
}

/** Single-value or multi-value suggestion fields share a catalog (`custom:<fieldId>`). */
export function isSuggestionAttributeType(type: AttributeType | string): boolean {
  return type === AttributeType.SUGGESTION || type === AttributeType.SUGGESTION_LIST;
}
