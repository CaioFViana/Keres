/** Tipos suportados por um atributo customizado de Story Schema. */
export enum AttributeType {
  TEXT = 'text',
  LONG_TEXT = 'long_text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  SUGGESTION = 'suggestion',
  SUGGESTION_LIST = 'suggestion_list',
  ENTITY = 'entity',
}

/** Single-value or multi-value suggestion fields share a catalog (`custom:<fieldId>`). */
export function isSuggestionAttributeType(type: AttributeType | string): boolean {
  return type === AttributeType.SUGGESTION || type === AttributeType.SUGGESTION_LIST;
}
