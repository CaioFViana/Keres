import type { OperationLogEntityType } from '../metadata/OperationLogEntityType';

/** A small, portable projection returned by a host application's persistence adapter. */
export type EntitySolverRow = Record<string, unknown>;

/** The two pieces of an entity reference used in operation logs, relations and field values. */
export interface EntityReference {
  name: string | undefined;
  type: string | undefined;
}

/**
 * Everything presentation solvers need from their host. Keeping this port free of Drizzle, React
 * and i18next lets the same solver run over the local SQLite database and the Admin API's
 * PostgreSQL database.
 */
export interface EntitySolverContext {
  storyId: string;
  read(type: OperationLogEntityType, id: string): Promise<EntitySolverRow | undefined>;
  translate(key: string, values?: Record<string, unknown>): string;
  noun(type: OperationLogEntityType | 'Event', plural?: boolean): Promise<string>;
  unknownNoun(type: OperationLogEntityType | 'Event'): Promise<string>;
}

export type EntityReferenceSolver = (
  context: EntitySolverContext,
  entityType: OperationLogEntityType,
  entityId: string,
) => Promise<EntityReference>;
