import type { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';

/**
 * Thin handler map used by helpers that entity handlers themselves import
 * (`compactEntityName`, `simpleEntitySolvers`, …).
 *
 * Keeping the map here — and the handler imports in `EntityRegistry` — breaks the Metro
 * require cycle: Registry → Handler → compactEntityName → Registry.
 */

let entityHandlers: ReadonlyMap<OperationLogEntityType, EntityDomainHandler> = new Map();

/** Called once from `EntityRegistry` after the handler table is built. */
export function setEntityHandlerMap(
  handlers: ReadonlyMap<OperationLogEntityType, EntityDomainHandler>,
): void {
  entityHandlers = handlers;
}

/** Factory for entity-owned domain presentation. An unknown external type has no handler. */
export function getEntityDomainHandler(
  entityType: OperationLogEntityType,
): EntityDomainHandler | undefined {
  return entityHandlers.get(entityType);
}
