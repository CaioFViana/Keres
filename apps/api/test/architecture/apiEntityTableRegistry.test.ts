import {
  getStoryExportCollections,
  getStoryImportCollectionOrder,
  getStorySyncEntityTypes,
  OperationLogEntityType,
} from '@keres/shared';
import { describe, expect, it } from 'vitest';
import { API_ENTITY_TABLES } from '../../src/services/entity-solvers/ApiEntityTableRegistry';

describe('API entity-table registry', () => {
  it('provides a PostgreSQL table adapter for every story-synchronized entity', () => {
    const missing = getStorySyncEntityTypes().filter(
      (entityType) => !API_ENTITY_TABLES[entityType],
    );

    expect(missing).toEqual([]);
  });

  it('can load every entity recorded by the audit and recovery flows', () => {
    const missing = Object.values(OperationLogEntityType).filter(
      (entityType) => !API_ENTITY_TABLES[entityType],
    );

    expect(missing).toEqual([]);
  });

  it('has a database table for every portable collection in the shared import order', () => {
    const entityTypeByCollection = new Map(
      getStoryExportCollections().map(({ collection, entityType }) => [collection, entityType]),
    );
    const missing = getStoryImportCollectionOrder().filter((collection) => {
      const entityType = entityTypeByCollection.get(collection);
      return !entityType || !API_ENTITY_TABLES[entityType];
    });

    expect(missing).toEqual([]);
  });
});
