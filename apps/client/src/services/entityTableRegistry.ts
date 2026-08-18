import { getTableColumns } from 'drizzle-orm';
import * as schema from '../db/schema';

/**
 * Mapa de nome de entidade (o mesmo usado no log de operações e no protocolo de
 * sincronização) para a tabela local correspondente.
 *
 * Existe porque a resolução de conflitos precisa escrever numa entidade escolhida em
 * tempo de execução: a tela sabe que o conflito é de um `'Chapter'`, mas não pode
 * importar a tabela de capítulos estaticamente sem repetir esse switch em cada caminho.
 */
export const ENTITY_TABLES = {
  Chapter: schema.chapters,
  Character: schema.characters,
  CharacterRelation: schema.characterRelations,
  CharacterScene: schema.characterScenes,
  Choice: schema.choices,
  Gallery: schema.galleries,
  GalleryRelation: schema.galleryRelations,
  Item: schema.items,
  ItemJourney: schema.itemJourneys,
  Location: schema.locations,
  LocationRelation: schema.locationRelations,
  Note: schema.notes,
  NoteRelation: schema.noteRelations,
  Scene: schema.scenes,
  SeeAlsoRelation: schema.seeAlsoRelations,
  Story: schema.stories,
  Suggestion: schema.suggestions,
  Tag: schema.tags,
  TagRelation: schema.tagRelations,
  WorldRule: schema.worldRules,
} as const;

export type SyncableEntityName = keyof typeof ENTITY_TABLES;

export function getEntityTable(entityType: string) {
  return (ENTITY_TABLES as Record<string, (typeof ENTITY_TABLES)[SyncableEntityName] | undefined>)[
    entityType
  ];
}

/** Campos de data: chegam como string no JSON e as tabelas locais esperam `Date`. */
const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'deletedAt']);

/**
 * Campos que nunca devem ser sobrescritos a partir de um payload externo, porque são
 * identidade da linha ou são administrados pelo próprio motor de sincronização.
 */
const PROTECTED_FIELDS = new Set(['id', 'storyId']);

/**
 * `CharacterRelation` é a única relação onde o nome do campo na tabela local (`charId1`/
 * `charId2`) difere do nome usado no payload logado e no servidor (`character1Id`/
 * `character2Id`) - `CharacterRelationService.toServerCharacterRelationPayload` já renomeia
 * antes de logar a operação. Sem este mapa, `toEntityColumns` descartava silenciosamente
 * `character1Id`/`character2Id` (nenhuma coluna da tabela local bate com esses nomes), e
 * "manter do servidor"/"manter o meu" numa relação de personagens nunca reescrevia de fato
 * quem está relacionado. Nenhuma outra relação precisa de entrada aqui: todas as outras
 * logam usando o próprio nome de coluna da tabela local.
 */
const SERVER_FIELD_ALIASES: Partial<Record<SyncableEntityName, Record<string, string>>> = {
  CharacterRelation: { character1Id: 'charId1', character2Id: 'charId2' },
};

/**
 * Normaliza um objeto vindo de JSON para algo que o drizzle aceite num `.set()`:
 * traduz nomes de campo em nomenclatura de servidor para os da tabela local, converte
 * datas, descarta campos protegidos e ignora chaves que não existem na tabela.
 */
export function toEntityColumns(
  entityType: string,
  values: Record<string, any>,
): Record<string, any> {
  const table = getEntityTable(entityType);
  if (!table) {
    return {};
  }

  const aliasMap = SERVER_FIELD_ALIASES[entityType as SyncableEntityName];
  const columns = new Set(Object.keys(getTableColumns(table)));
  const normalized: Record<string, any> = {};

  for (const [rawKey, value] of Object.entries(values)) {
    const key = aliasMap?.[rawKey] ?? rawKey;
    if (PROTECTED_FIELDS.has(key) || !columns.has(key)) {
      continue;
    }
    if (DATE_FIELDS.has(key)) {
      normalized[key] = value ? new Date(value) : null;
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
}
