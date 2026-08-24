import { inArray } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import type { SyncableEntityName } from './entityTableRegistry';
import { getEntityTable } from './entityTableRegistry';

export interface EntityRef {
  entityType: string;
  entityId: string;
}

export interface EntityNameBatchResolver {
  /**
   * Resolve todas as referências de uma vez: agrupa por tipo, faz uma query `inArray` por
   * tabela (não uma por referência), e devolve um mapa `"Tipo:id" -> nome de exibição`.
   *
   * Existe porque `EntityService.getEntityIdentifier`/`_resolveRelationEntityName` são
   * estritamente um-id-por-vez - correto para uma tela de detalhe com poucos campos, mas uma
   * lista de conflitos de sync pode referenciar dezenas de entidades (várias vezes a mesma).
   * Resolver um a um viraria dezenas de round-trips sequenciais ao SQLite; isto faz no máximo
   * uma consulta por tipo de entidade distinto tocado pelo lote inteiro.
   */
  resolveMany(refs: EntityRef[]): Promise<Map<string, string>>;
}

const nameKey = (entityType: string, entityId: string) => `${entityType}:${entityId}`;

/** Coluna que carrega o nome de exibição de cada tipo simples que uma relação pode apontar. */
const NAME_COLUMN_BY_ENTITY: Partial<Record<SyncableEntityName, string>> = {
  Character: 'name',
  Location: 'name',
  Item: 'name',
  Tag: 'name',
  Scene: 'name',
  Chapter: 'name',
  Note: 'title',
  WorldRule: 'title',
  Story: 'title',
  Choice: 'text',
  Stat: 'name',
  Mode: 'name',
  StatStrength: 'label',
};

export function createEntityNameBatchResolver(db: AppDrizzleClient): EntityNameBatchResolver {
  return {
    async resolveMany(refs: EntityRef[]): Promise<Map<string, string>> {
      const idsByType = new Map<string, Set<string>>();
      for (const ref of refs) {
        if (!ref.entityType || !ref.entityId) continue;
        const set = idsByType.get(ref.entityType) ?? new Set<string>();
        set.add(ref.entityId);
        idsByType.set(ref.entityType, set);
      }

      const result = new Map<string, string>();

      for (const [entityType, ids] of idsByType) {
        const table = getEntityTable(entityType);
        if (!table) continue;
        const idList = Array.from(ids);

        // Gallery não tem uma única coluna de nome - `title` é opcional e cai para o nome do
        // arquivo, igual ao resto do app já faz em `EntityService.getEntityName`.
        if (entityType === 'Gallery') {
          const rows = await db
            .select({
              id: (table as any).id,
              title: (table as any).title,
              fileName: (table as any).fileName,
            })
            .from(table)
            .where(inArray((table as any).id, idList));
          for (const row of rows) {
            result.set(nameKey(entityType, row.id), row.title || row.fileName || row.id);
          }
          continue;
        }

        const nameColumn = NAME_COLUMN_BY_ENTITY[entityType as SyncableEntityName];
        if (!nameColumn) continue;

        const rows = await db
          .select({ id: (table as any).id, name: (table as any)[nameColumn] })
          .from(table)
          .where(inArray((table as any).id, idList));
        for (const row of rows) {
          result.set(nameKey(entityType, row.id), row.name || row.id);
        }
      }

      return result;
    },
  };
}

export interface EntitySnapshotResolver {
  /**
   * Resolve a linha local inteira de cada referência, não só um nome - usado para preencher
   * campos que faltam tanto em `localValues` quanto em `serverValues` de um `PendingConflict`
   * (ex.: um conflito `deleted_on_server` carrega só `{isDeleted, version}` do lado do
   * servidor, de propósito - a linha local em si não foi apagada, e ainda tem o `name`/os IDs
   * de relação originais). Mesmo agrupamento por tipo e uma query `inArray` por tabela que
   * `resolveMany` já usa.
   */
  resolveMany(refs: EntityRef[]): Promise<Map<string, Record<string, any>>>;
}

export function createEntitySnapshotResolver(db: AppDrizzleClient): EntitySnapshotResolver {
  return {
    async resolveMany(refs: EntityRef[]): Promise<Map<string, Record<string, any>>> {
      const idsByType = new Map<string, Set<string>>();
      for (const ref of refs) {
        if (!ref.entityType || !ref.entityId) continue;
        const set = idsByType.get(ref.entityType) ?? new Set<string>();
        set.add(ref.entityId);
        idsByType.set(ref.entityType, set);
      }

      const result = new Map<string, Record<string, any>>();

      for (const [entityType, ids] of idsByType) {
        const table = getEntityTable(entityType);
        if (!table) continue;
        const idList = Array.from(ids);

        const rows = (await db
          .select()
          .from(table)
          .where(inArray((table as any).id, idList))) as Record<string, any>[];
        for (const row of rows) {
          result.set(nameKey(entityType, row.id), row);
        }
      }

      return result;
    },
  };
}
