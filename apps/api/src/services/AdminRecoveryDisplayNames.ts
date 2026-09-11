import {
  getEntityRowReferences,
  OperationLogEntityType,
  resolveCompactEntityName,
  type EntitySolverContext,
} from '@keres/shared';
import { inArray } from 'drizzle-orm';
import { db } from '../db';
import { stories, users } from '../db/schema';
import { getApiEntityTable } from './entity-solvers/ApiEntityTableRegistry';

type EntityRow = Record<string, unknown>;
type EntityRows = Map<string, EntityRow>;
type NameMap = Map<string, string | null>;

const rowKey = (entityType: string, id: string) => `${entityType}:${id}`;

function asEntityType(entityType: string): OperationLogEntityType | undefined {
  return Object.values(OperationLogEntityType).includes(entityType as OperationLogEntityType)
    ? (entityType as OperationLogEntityType)
    : undefined;
}

/**
 * Persistence-only graph hydration for a recovery page. Reference ownership comes from the shared
 * entity handlers, so adding an entity never requires another relation switch in the Admin API.
 */
async function hydrateReferencedRows(seedRows: EntityRows): Promise<EntityRows> {
  const rows = new Map(seedRows);
  const pending = [...rows.entries()].flatMap(([key, row]) => {
    const separator = key.indexOf(':');
    return separator < 0 ? [] : getEntityRowReferences(key.slice(0, separator), row);
  });

  while (pending.length > 0) {
    const refsByType = new Map<string, Set<string>>();
    for (const ref of pending.splice(0)) {
      const entityType = asEntityType(ref.entityType);
      if (!entityType || !ref.id || rows.has(rowKey(entityType, ref.id))) continue;
      const ids = refsByType.get(entityType) ?? new Set<string>();
      ids.add(ref.id);
      refsByType.set(entityType, ids);
    }

    await Promise.all(
      [...refsByType].map(async ([entityType, ids]) => {
        const table = getApiEntityTable(entityType);
        if (!table) return;
        const fetchedRows = await db
          .select()
          .from(table)
          .where(inArray(table.id, [...ids]));
        for (const fetched of fetchedRows as Array<{ id: string }>) {
          const key = rowKey(entityType, fetched.id);
          const row = fetched as unknown as EntityRow;
          if (rows.has(key)) continue;
          rows.set(key, row);
          pending.push(...getEntityRowReferences(entityType, row));
        }
      }),
    );
  }

  return rows;
}

function recoverySolverContext(rows: EntityRows, storyId: string): EntitySolverContext {
  const fallbackNoun = (type: OperationLogEntityType | 'Event') => String(type);
  return {
    storyId,
    read: async (entityType, id) => rows.get(rowKey(entityType, id)),
    // Compact labels are deliberately untranslated. These methods keep the context compatible
    // with all shared handlers while allowing a host to opt into richer translated solvers later.
    translate: (key) => key,
    noun: async (type) => fallbackNoun(type),
    fromNoun: async (type) => fallbackNoun(type),
    unknownNoun: async (type) => fallbackNoun(type),
  };
}

async function resolveNames(
  rows: EntityRows,
  sources: Array<{ entityType: string; id: string; storyId: string; fallbackName?: string | null }>,
): Promise<NameMap> {
  const names = new Map<string, string | null>();
  await Promise.all(
    sources.map(async ({ entityType, id, storyId, fallbackName }) => {
      const type = asEntityType(entityType);
      const name = type
        ? await resolveCompactEntityName(recoverySolverContext(rows, storyId), type, id)
        : undefined;
      names.set(rowKey(entityType, id), name ?? fallbackName ?? null);
    }),
  );
  return names;
}

async function loadStoryTitles(storyIds: Iterable<string>): Promise<Map<string, string>> {
  const ids = [...new Set([...storyIds].filter(Boolean))];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: stories.id, title: stories.title })
    .from(stories)
    .where(inArray(stories.id, ids));
  return new Map(
    rows.flatMap((row) => (row.title?.trim() ? [[row.id, row.title.trim()] as const] : [])),
  );
}

export interface EnrichableDeletedRow {
  entityType: string;
  id: string;
  storyId: string | null;
  name: string | null;
  row: EntityRow;
}

/** Resolves compact handler-owned labels for deleted rows without leaking database concerns into shared. */
export async function enrichDeletedDisplayNames(
  items: EnrichableDeletedRow[],
): Promise<{ names: NameMap; storyTitles: Map<string, string> }> {
  const seedRows = new Map(items.map((item) => [rowKey(item.entityType, item.id), item.row]));
  const rows = await hydrateReferencedRows(seedRows);
  const storyIds = items.flatMap((item) =>
    item.entityType === OperationLogEntityType.Story
      ? [item.id]
      : item.storyId
        ? [item.storyId]
        : [],
  );
  return {
    names: await resolveNames(
      rows,
      items.map((item) => ({
        entityType: item.entityType,
        id: item.id,
        storyId: item.storyId ?? '',
        fallbackName: item.name,
      })),
    ),
    storyTitles: await loadStoryTitles(storyIds),
  };
}

function payloadAsRow(payload: unknown): EntityRow {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  return payload as EntityRow;
}

export interface OperationLogNameSource {
  id: string;
  entityType: string;
  entityId: string;
  storyId: string;
  userId: string;
  payload: unknown;
}

export interface OperationLogNameEnrichment {
  entityName: string | null;
  storyTitle: string | null;
  username: string | null;
}

async function loadRootRows(entries: OperationLogNameSource[]): Promise<EntityRows> {
  const idsByType = new Map<string, Set<string>>();
  for (const entry of entries) {
    const entityType = asEntityType(entry.entityType);
    if (!entityType) continue;
    const ids = idsByType.get(entityType) ?? new Set<string>();
    ids.add(entry.entityId);
    idsByType.set(entityType, ids);
  }
  const rows: EntityRows = new Map();
  await Promise.all(
    [...idsByType].map(async ([entityType, ids]) => {
      const table = getApiEntityTable(entityType);
      if (!table) return;
      const fetchedRows = await db
        .select()
        .from(table)
        .where(inArray(table.id, [...ids]));
      for (const row of fetchedRows as Array<{ id: string }>) {
        rows.set(rowKey(entityType, row.id), row as unknown as EntityRow);
      }
    }),
  );
  return rows;
}

/**
 * Resolves audit labels from current rows plus the log payload. The payload wins so a deletion
 * remains understandable even if its referenced row is no longer present in the database.
 */
export async function enrichOperationLogNames(
  entries: OperationLogNameSource[],
): Promise<Map<string, OperationLogNameEnrichment>> {
  const rootRows = await loadRootRows(entries);
  for (const entry of entries) {
    const key = rowKey(entry.entityType, entry.entityId);
    rootRows.set(key, { ...(rootRows.get(key) ?? {}), ...payloadAsRow(entry.payload) });
  }
  const rows = await hydrateReferencedRows(rootRows);
  const [names, storyTitles, userRows] = await Promise.all([
    resolveNames(
      rows,
      entries.map((entry) => ({
        entityType: entry.entityType,
        id: entry.entityId,
        storyId: entry.storyId,
      })),
    ),
    loadStoryTitles(entries.map((entry) => entry.storyId)),
    (() => {
      const ids = [...new Set(entries.map((entry) => entry.userId).filter(Boolean))];
      return ids.length === 0
        ? Promise.resolve([] as Array<{ id: string; username: string }>)
        : db
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(inArray(users.id, ids));
    })(),
  ]);
  const usernames = new Map(userRows.map((row) => [row.id, row.username]));

  return new Map(
    entries.map((entry) => [
      entry.id,
      {
        entityName: names.get(rowKey(entry.entityType, entry.entityId)) ?? null,
        storyTitle: storyTitles.get(entry.storyId) ?? null,
        username: usernames.get(entry.userId) ?? null,
      },
    ]),
  );
}
