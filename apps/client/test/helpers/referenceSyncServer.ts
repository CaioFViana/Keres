import {
  ARRANGED,
  derivePositions,
  rankAtPositionOf,
  safeParseStoryUpdate,
  type StoryUpdate,
} from '@keres/shared';

/**
 * An in-memory model of the API's sync protocol, faithful to what the client can observe:
 * per-entity optimistic concurrency (`changes.version` must equal the row's version), one
 * operation log per story with a dense `operationVersion`, the entity version recorded AFTER each
 * operation, `changedFields` since the client's base, idempotent resends keyed by
 * `clientOperationId`, per-operation envelope validation, and paged pulls.
 *
 * It exists so convergence can be tested end to end - several real `SyncEngineService`
 * instances, each over its own SQLite database, talking to one server through the axios
 * adapter - without Postgres or the Bun API in the Jest process. It models scalar entities
 * (create/update/delete), arranged rows' ranks with their positions derived after every write
 * (as `arrangedRanks.ts` does), the refusal of container orders, and history compaction
 * (squashing runs of updates into their last row, as `SyncHistoryCompaction` does).
 */

/** Fields the client never writes (mirrors `SYNC_CLIENT_IMMUTABLE_FIELDS`). */
const IMMUTABLE = new Set([
  'id',
  'storyId',
  'userId',
  'authorUserId',
  'version',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'isDeleted',
  'lastOperationVersion',
]);
/** Excluded from `changedFields` (mirrors `SyncConflictDetails.bookkeepingFields`). */
const BOOKKEEPING = new Set(['id', 'storyId', 'version', 'createdAt', 'updatedAt', 'deletedAt']);

export interface ServerRow {
  id: string;
  version: number;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  [field: string]: unknown;
}

interface LogRow {
  id: string;
  operationVersion: number;
  operationType: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  entityVersion: number;
  clientOperationId: string | null;
  createdAt: string;
}

const withoutImmutable = (values: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(values).filter(([key]) => !IMMUTABLE.has(key)));

/** The handlers' `naturalKey`: two live rows never share these. */
const NATURAL_KEYS: Record<string, readonly string[]> = {
  AttributeValue: ['entityId', 'fieldId'],
  CharacterRelation: ['character1Id', 'character2Id'],
  Favorite: ['entityId', 'entityType', 'userId'],
  PlotScene: ['plotId', 'sceneId'],
  RouteStep: ['routeId', 'position'],
  StorySchemaField: ['entityType', 'key'],
  Suggestion: ['type', 'value'],
  LocationRelation: ['locationAId', 'locationBId', 'relationType'],
  StoryArc: ['isDefault'],
  Tag: ['name'],
  TagRelation: ['tagId', 'relationId', 'relationType'],
};

/** The one user the model knows: every push is theirs. */
const ACTING_USER = 'server-user';

/** Rows owned by whoever wrote them: the API takes the owner from the session, never the payload. */
const OWNER_FIELDS: Record<string, string> = { Favorite: 'userId', Comment: 'authorUserId' };

/**
 * What the handlers store instead of what arrives: a relation's pair sorted, and an owned row's
 * owner as the acting user (set on create, never changed after).
 */
function normalized(
  entityType: string,
  values: Record<string, unknown>,
  type: 'create' | 'update' = 'update',
) {
  const owner = OWNER_FIELDS[entityType];
  if (owner) {
    const { [owner]: _sent, ...rest } = values;
    values = type === 'create' ? { ...rest, [owner]: ACTING_USER } : rest;
  }
  if (
    entityType === 'LocationRelation' &&
    values.relationType === 'connected_to' &&
    typeof values.locationAId === 'string' &&
    typeof values.locationBId === 'string' &&
    values.locationAId > values.locationBId
  ) {
    return { ...values, locationAId: values.locationBId, locationBId: values.locationAId };
  }
  if (
    entityType === 'CharacterRelation' &&
    typeof values.character1Id === 'string' &&
    typeof values.character2Id === 'string' &&
    values.character1Id > values.character2Id
  ) {
    return { ...values, character1Id: values.character2Id, character2Id: values.character1Id };
  }
  return values;
}

export class ReferenceSyncServer {
  readonly rows = new Map<string, ServerRow>();
  readonly log: LogRow[] = [];
  /** Page size of the pull; small values exercise paging. */
  pullPageSize = 500;
  private nextLogId = 1;

  /**
   * @param columns Content columns per entity type. A real row holds every column (null when
   *   never set), and a whole-row snapshot or restore carries them all - a model that omitted
   *   the unset ones would hide exactly the drift those payloads exist to repair.
   */
  constructor(
    readonly storyId: string,
    private readonly columns: Record<string, readonly string[]> = {},
  ) {}

  private blankRow(entityType: string): Record<string, unknown> {
    return Object.fromEntries((this.columns[entityType] ?? []).map((column) => [column, null]));
  }

  private key(entityType: string, id: string): string {
    return `${entityType}:${id}`;
  }

  row(entityType: string, id: string): ServerRow | undefined {
    return this.rows.get(this.key(entityType, id));
  }

  /** The story's counter: compaction removes rows but never the numbers they used. */
  private counter = 0;

  get lastOperationVersion(): number {
    return this.counter;
  }

  /** Places a row with no history - the story itself, which an upload creates outside sync. */
  place(entityType: string, id: string, fields: Record<string, unknown> = {}): void {
    const now = new Date('2026-01-01T00:00:00.000Z').toISOString();
    this.rows.set(this.key(entityType, id), {
      ...this.blankRow(entityType),
      id,
      version: 1,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      ...fields,
    });
  }

  /** Seeds a row as if created through sync long ago, with its create in the log. */
  seed(entityType: string, id: string, fields: Record<string, unknown>): void {
    const now = new Date('2026-01-01T00:00:00.000Z').toISOString();
    this.rows.set(this.key(entityType, id), {
      ...this.blankRow(entityType),
      id,
      version: 1,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      ...fields,
    });
    this.renumber(entityType);
    this.append('create', entityType, id, withoutImmutable(fields), 1, null, now);
  }

  private append(
    operationType: LogRow['operationType'],
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>,
    entityVersion: number,
    clientOperationId: string | null,
    createdAt: string,
  ): LogRow {
    const row: LogRow = {
      id: `srv-op-${this.nextLogId++}`,
      operationVersion: ++this.counter,
      operationType,
      entityType,
      entityId,
      payload,
      entityVersion,
      clientOperationId,
      createdAt,
    };
    this.log.push(row);
    return row;
  }

  /** `findLiveTwin`: the live row of another id with the same natural key. */
  private liveTwin(entityType: string, row: Record<string, unknown>): ServerRow | undefined {
    const fields = NATURAL_KEYS[entityType];
    if (!fields) return undefined;
    // Like the API: only the default arc has a twin - any other arc is its own.
    if (entityType === 'StoryArc' && row.isDefault !== true) return undefined;
    // Like the API: a connection is one unordered pair; a containment, one parent per child.
    const matches =
      entityType === 'LocationRelation'
        ? (candidate: Record<string, unknown>) =>
            candidate.relationType === row.relationType &&
            candidate.locationBId === row.locationBId &&
            (row.relationType !== 'connected_to' || candidate.locationAId === row.locationAId)
        : (candidate: Record<string, unknown>) =>
            fields.every((field) => (candidate[field] ?? null) === (row[field] ?? null));
    for (const [key, candidate] of this.rows) {
      if (!key.startsWith(`${entityType}:`) || candidate.isDeleted || candidate.id === row.id) {
        continue;
      }
      if (matches(candidate)) return candidate;
    }
    return undefined;
  }

  /** `SyncConflictDetails.getEntityLastOperationVersion`. */
  private lastOperationOf(entityType: string, entityId: string): number | undefined {
    const rows = this.log.filter(
      (row) => row.entityType === entityType && row.entityId === entityId,
    );
    return rows.length > 0 ? Math.max(...rows.map((row) => row.operationVersion)) : undefined;
  }

  private changedFieldsSince(entityType: string, entityId: string, sinceVersion: number) {
    const fields = new Set<string>();
    for (const row of this.log) {
      if (row.entityType !== entityType || row.entityId !== entityId) continue;
      if (row.entityVersion <= sinceVersion) continue;
      for (const key of Object.keys(row.payload)) {
        if (!BOOKKEEPING.has(key)) fields.add(key);
      }
    }
    return [...fields];
  }

  /** POST /sync/:storyId */
  push(rawUpdates: unknown[]) {
    const applied: Record<string, unknown>[] = [];
    const conflicts: Record<string, unknown>[] = [];
    const blocked = new Set<string>();

    for (const raw of rawUpdates) {
      const parsed = safeParseStoryUpdate(raw);
      const envelope = (raw ?? {}) as Record<string, unknown>;
      if (!parsed.success) {
        blocked.add(this.key(String(envelope.entity), String(envelope.id ?? '')));
        conflicts.push({
          clientOperationId: envelope.clientOperationId,
          entity: String(envelope.entity ?? 'unknown'),
          entityId: String(envelope.id ?? ''),
          type: 'update',
          reason: 'validation',
          message: parsed.error,
        });
        continue;
      }
      const update = this.normalizeArranged(parsed.data as StoryUpdate & Record<string, any>);
      const entityId = update.id ?? '';
      const key = this.key(update.entity, entityId);

      if (update.clientOperationId) {
        const recorded = this.log.find((row) => row.clientOperationId === update.clientOperationId);
        if (recorded) {
          applied.push({
            clientOperationId: update.clientOperationId,
            operationVersion: recorded.operationVersion,
            entityVersion: this.rows.get(key)?.version ?? recorded.entityVersion,
            entity: update.entity,
            entityId,
          });
          continue;
        }
      }

      const current = this.rows.get(key);
      const serialized = current ? { ...current } : null;
      const refuse = (reason: string, extra: Record<string, unknown> = {}) => {
        blocked.add(key);
        conflicts.push({
          clientOperationId: update.clientOperationId,
          entity: update.entity,
          entityId,
          type: update.type,
          reason,
          message: `${reason} on ${key}`,
          serverEntity: serialized,
          serverVersion: current?.version,
          ...extra,
        });
      };
      if (blocked.has(key)) {
        // Like the API: a bare refusal, judging nothing about the entity.
        conflicts.push({
          clientOperationId: update.clientOperationId,
          entity: update.entity,
          entityId,
          type: update.type,
          reason: 'version_conflict',
          message: `Skipped: an earlier operation on ${key} in this batch conflicted.`,
        });
        continue;
      }
      const time = update.operationTime ?? new Date().toISOString();

      if (update.type === 'create') {
        if (current) {
          applied.push({
            clientOperationId: update.clientOperationId,
            operationVersion: 0,
            entityVersion: current.version,
            entity: update.entity,
            entityId,
          });
          continue;
        }
        const payload = normalized(update.entity, withoutImmutable(update.data ?? {}), 'create');
        const twin = this.liveTwin(update.entity, { ...payload, id: entityId });
        if (twin) {
          refuse('duplicate', {
            serverEntity: { ...twin },
            serverVersion: twin.version,
            ...(serialized ? { ownEntity: serialized } : {}),
          });
          continue;
        }
        this.rows.set(key, {
          ...this.blankRow(update.entity),
          id: entityId,
          version: 1,
          isDeleted: false,
          deletedAt: null,
          createdAt: time,
          updatedAt: time,
          ...payload,
        });
        this.renumber(update.entity);
        const logged = this.append(
          'create',
          update.entity,
          entityId,
          payload,
          1,
          update.clientOperationId ?? null,
          time,
        );
        applied.push({
          clientOperationId: update.clientOperationId,
          operationId: logged.id,
          operationVersion: logged.operationVersion,
          entityVersion: 1,
          entity: update.entity,
          entityId,
        });
        continue;
      }

      if (update.type === 'update') {
        if (!current) {
          refuse('not_found');
          continue;
        }
        const changes = normalized(update.entity, { ...(update.changes ?? {}) }) as Record<
          string,
          unknown
        >;
        const restore = changes.isDeleted === false;
        // Like `refuseTwin`: restored or re-keyed, a row may become what a live one already is.
        const keyed = (NATURAL_KEYS[update.entity] ?? []).some((field) => field in changes);
        if ((!current.isDeleted || restore) && (restore || keyed)) {
          const twin = this.liveTwin(update.entity, { ...current, ...changes, id: entityId });
          if (twin) {
            refuse('duplicate', {
              serverEntity: { ...twin },
              serverVersion: twin.version,
              ...(serialized ? { ownEntity: serialized } : {}),
            });
            continue;
          }
        }
        if (current.isDeleted && !restore) {
          refuse('deleted_on_server', { clientVersion: changes.version });
          continue;
        }
        if (changes.version !== current.version) {
          refuse('version_conflict', {
            clientVersion: changes.version,
            changedFields: this.changedFieldsSince(
              update.entity,
              entityId,
              changes.version as number,
            ),
            entityOperationVersion: this.lastOperationOf(update.entity, entityId),
          });
          continue;
        }
        let payload = withoutImmutable(changes);
        const wasDeleted = current.isDeleted;
        Object.assign(current, payload, { version: current.version + 1, updatedAt: time });
        if (restore) {
          current.isDeleted = false;
          current.deletedAt = null;
        }
        this.renumber(update.entity);
        if (restore) {
          // Like the API, a restore records the whole restored row.
          payload = wasDeleted
            ? { ...withoutImmutable(current), isDeleted: false, deletedAt: null }
            : { ...payload, isDeleted: false, deletedAt: null };
        }
        const logged = this.append(
          'update',
          update.entity,
          entityId,
          payload,
          current.version,
          update.clientOperationId ?? null,
          time,
        );
        applied.push({
          clientOperationId: update.clientOperationId,
          operationId: logged.id,
          operationVersion: logged.operationVersion,
          entityVersion: current.version,
          entity: update.entity,
          entityId,
        });
        continue;
      }

      if (update.type === 'delete') {
        if (!current || current.isDeleted) {
          applied.push({
            clientOperationId: update.clientOperationId,
            operationVersion: 0,
            entityVersion: current?.version,
            entity: update.entity,
            entityId,
          });
          continue;
        }
        if (update.version !== current.version) {
          refuse('version_conflict', {
            clientVersion: update.version,
            entityOperationVersion: this.lastOperationOf(update.entity, entityId),
          });
          continue;
        }
        Object.assign(current, {
          isDeleted: true,
          deletedAt: time,
          updatedAt: time,
          version: current.version + 1,
        });
        this.renumber(update.entity);
        // Like the API, a deletion records the whole tombstone.
        const logged = this.append(
          'delete',
          update.entity,
          entityId,
          { id: entityId, ...withoutImmutable(current), isDeleted: true },
          current.version,
          update.clientOperationId ?? null,
          time,
        );
        applied.push({
          clientOperationId: update.clientOperationId,
          operationId: logged.id,
          operationVersion: logged.operationVersion,
          entityVersion: current.version,
          entity: update.entity,
          entityId,
        });
        continue;
      }

      refuse('unknown');
    }

    return {
      message: 'ok',
      processedUpdates: rawUpdates.length,
      serverMaxOperationVersion: this.lastOperationVersion,
      applied,
      conflicts,
    };
  }

  /**
   * `normalizeArrangedUpdate`: an arranged row's position is derived, so an update never writes
   * it; a create may state a position instead of a rank, and is ranked from it.
   */
  private normalizeArranged(update: StoryUpdate & Record<string, any>) {
    const arranged = ARRANGED[update.entity];
    if (!arranged) return update;
    if (update.type === 'create') {
      const data = { ...(update.data ?? {}) } as Record<string, unknown>;
      if (typeof data.rank !== 'string' || data.rank.length === 0) {
        const position = data[arranged.positionField];
        data.rank = rankAtPositionOf(
          update.entity,
          typeof position === 'number' ? position : arranged.base,
        );
      }
      return { ...update, data };
    }
    if (update.type === 'update') {
      const changes = { ...(update.changes ?? {}) } as Record<string, unknown>;
      delete changes[arranged.positionField];
      return { ...update, changes };
    }
    return update;
  }

  /** `renumberArranged`: positions derived from ranks, never touching a version. */
  private renumber(entityType: string): void {
    const arranged = ARRANGED[entityType];
    if (!arranged) return;
    const rows = [...this.rows.entries()]
      .filter(([key]) => key.startsWith(`${entityType}:`))
      .map(([, row]) => row);
    for (const row of rows) {
      if (typeof row.rank !== 'string' || row.rank.length === 0) {
        row.rank = rankAtPositionOf(entityType, row[arranged.positionField] as number);
      }
    }
    const positions = derivePositions(
      entityType,
      rows as (ServerRow & { rank: string; isDeleted: boolean })[],
    );
    for (const row of rows) {
      const position = positions.get(row.id);
      if (position !== undefined) row[arranged.positionField] = position;
    }
  }

  /**
   * `compactStoryUpdateHistory` without the age gate (every row counts as old): runs of `update`
   * rows of one entity, not crossing any other operation on it, collapse into their LAST row,
   * which keeps its version and takes the merged payload. The newest `keepRecentPerEntity`
   * updates per entity stay granular.
   */
  compact(keepRecentPerEntity: number): void {
    const updatesByEntity = new Map<string, LogRow[]>();
    for (const row of this.log) {
      if (row.operationType !== 'update') continue;
      const key = this.key(row.entityType, row.entityId);
      updatesByEntity.set(key, [...(updatesByEntity.get(key) ?? []), row]);
    }
    const protectedRows = new Set<LogRow>();
    if (keepRecentPerEntity > 0) {
      for (const rows of updatesByEntity.values()) {
        for (const row of rows.slice(-keepRecentPerEntity)) protectedRows.add(row);
      }
    }
    const open = new Map<string, LogRow[]>();
    const runs: LogRow[][] = [];
    const close = (key: string) => {
      const run = open.get(key);
      if (run && run.length >= 2) runs.push(run);
      open.delete(key);
    };
    for (const row of this.log) {
      const key = this.key(row.entityType, row.entityId);
      if (row.operationType !== 'update' || protectedRows.has(row)) {
        close(key);
        continue;
      }
      open.set(key, [...(open.get(key) ?? []), row]);
    }
    for (const key of [...open.keys()]) close(key);
    const removed = new Set<LogRow>();
    for (const run of runs) {
      const keep = run.at(-1)!;
      keep.payload = Object.assign({}, ...run.map((row) => row.payload));
      for (const row of run.slice(0, -1)) removed.add(row);
    }
    for (let index = this.log.length - 1; index >= 0; index -= 1) {
      if (removed.has(this.log[index]!)) this.log.splice(index, 1);
    }
  }

  /** GET /sync/:storyId/pull */
  pull(lastOperationVersion: number) {
    const page = this.log
      .filter((row) => row.operationVersion > lastOperationVersion)
      .slice(0, this.pullPageSize);
    return {
      message: 'ok',
      updates: page.map((row) => this.toStoryUpdate(row)),
      publicFavorites: [],
      serverMaxOperationVersion: this.lastOperationVersion,
      role: 'owner',
    };
  }

  private toStoryUpdate(row: LogRow) {
    const metadata = {
      id: row.entityId,
      version: row.entityVersion,
      operationVersion: row.operationVersion,
      operationTime: row.createdAt,
      originatingUser: 'server-user',
      operationId: row.id,
      ...(row.clientOperationId ? { clientOperationId: row.clientOperationId } : {}),
    };
    if (row.operationType === 'create') {
      return {
        type: 'create',
        entity: row.entityType,
        data: {
          ...row.payload,
          createdAt: row.createdAt,
          updatedAt: row.createdAt,
          version: row.entityVersion,
          isDeleted: false,
          deletedAt: null,
        },
        ...metadata,
      };
    }
    if (row.operationType === 'update') {
      return {
        type: 'update',
        entity: row.entityType,
        changes: { ...row.payload, updatedAt: row.createdAt, version: row.entityVersion },
        ...metadata,
      };
    }
    const { id: _id, ...tombstone } = row.payload;
    return {
      type: 'delete',
      entity: row.entityType,
      ...metadata,
      ...(Object.keys(tombstone).length > 0 ? { data: tombstone } : {}),
    };
  }
}
