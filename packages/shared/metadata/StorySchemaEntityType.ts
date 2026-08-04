/**
 * Tipos de entidade que podem receber atributos customizados via Story Schemas - as entidades
 * com Form + Detail screen dedicadas, excluindo tabelas de relação/junção (CharacterRelation,
 * TagRelation, NoteRelation, CharacterScene, GalleryRelation), Choice/Gallery (forms
 * estruturalmente diferentes) e a própria Story.
 *
 * Um array de constantes em vez de um enum para ficar trivial adicionar um tipo novo depois
 * (uma linha), sem precisar tocar em nenhum outro lugar que dependa da forma do enum.
 */
export const STORY_SCHEMA_ENTITY_TYPES = [
  'Character',
  'Location',
  'Item',
  'Scene',
  'Chapter',
  'Note',
  'WorldRule',
] as const;

export type StorySchemaEntityType = typeof STORY_SCHEMA_ENTITY_TYPES[number];
