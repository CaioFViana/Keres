/**
 * Tipos de entidade que podem receber comentários por campo. Espelha `GlobalSearchEntityType`
 * (`packages/shared/metadata/globalSearchFields.ts`) e `NavigableEntityType`
 * (`apps/client/src/utils/entityNavigation.ts`) de propósito - os mesmos 10 tipos navegáveis,
 * sincronizados manualmente entre os três arquivos como já é convenção no projeto. Ao
 * contrário de `SeeAlsoEntityType`, inclui Tag e Note: comentário é um conceito genérico de
 * anotação, não faz sentido restringi-lo à mesma lista de exclusões do "Veja também".
 */
export const COMMENT_ENTITY_TYPES = [
  'Character',
  'Scene',
  'Location',
  'Item',
  'ItemJourney',
  'Tag',
  'Choice',
  'Chapter',
  'Note',
  'WorldRule',
] as const;

export type CommentEntityType = typeof COMMENT_ENTITY_TYPES[number];
