import { OperationLogEntityType } from '../metadata/OperationLogEntityType';
import { getEntityReferenceFieldType } from './entities/EntityRegistry';

/** Looks up the target declared by the entity handler that owns a persisted reference field. */
export function resolveEntityReferenceFieldType(field: string): OperationLogEntityType | undefined {
  return getEntityReferenceFieldType(field);
}
