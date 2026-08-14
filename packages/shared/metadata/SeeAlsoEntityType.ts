/**
 * Tipos de entidade que podem ser marcados como "Veja também" um do outro - as entidades
 * navegáveis do sistema exceto Tag/Note (que já têm seus próprios sistemas de relação
 * flexíveis via TagRelation/NoteRelation) e Gallery (que não é navegável).
 */
export const SEE_ALSO_ENTITY_TYPES = [
  'Character',
  'Location',
  'Chapter',
  'Scene',
  'Item',
  'ItemJourney',
  'WorldRule',
  'Choice',
] as const;

export type SeeAlsoEntityType = (typeof SEE_ALSO_ENTITY_TYPES)[number];
