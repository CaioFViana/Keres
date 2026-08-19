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
const PROTECTED_FIELDS = new Set([
  'id',
  'storyId',
  'serverId',
  'lastOperationLog',
  'lastServerSyncedLog',
  'lastPublicFavoriteLog',
  'myRole',
]);

const PROTECTED_BY_ENTITY: Record<string, ReadonlySet<string>> = {
  Story: new Set(['userId']),
};

/**
 * Normaliza um objeto vindo de JSON para algo que o drizzle aceite num `.set()`:
 * converte datas, descarta campos protegidos e ignora chaves que não existem na tabela.
 */
export function toEntityColumns(
  entityType: string,
  values: Record<string, any>,
): Record<string, any> {
  const table = getEntityTable(entityType);
  if (!table) {
    return {};
  }

  const columns = new Set(Object.keys(getTableColumns(table)));
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(values)) {
    if (PROTECTED_FIELDS.has(key) || PROTECTED_BY_ENTITY[entityType]?.has(key) || !columns.has(key)) {
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

/** Descarta colunas de bookkeeping local mesmo quando a entidade não está no registro. */
export function omitClientProtectedFields(
  entityType: string,
  payload: Record<string, any> | undefined,
): Record<string, any> {
  const out: Record<string, any> = { ...(payload ?? {}) };
  for (const key of PROTECTED_FIELDS) {
    delete out[key];
  }
  for (const key of PROTECTED_BY_ENTITY[entityType] ?? []) {
    delete out[key];
  }
  return out;
}
