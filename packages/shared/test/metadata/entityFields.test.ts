import { describe, expect, it } from 'vitest';
import { entityFieldMetadata } from '../../metadata/entityFields';
import { globalSearchFieldConfig, type GlobalSearchEntityType } from '../../metadata/globalSearchFields';

const globalSearchEntities = Object.keys(globalSearchFieldConfig) as GlobalSearchEntityType[];

describe('entityFieldMetadata', () => {
  it.each(Object.keys(entityFieldMetadata))('declares %s fields without duplicates', (entityName) => {
    const names = entityFieldMetadata[entityName].map((field) => field.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('always provides a label or a resolved rawLabel', () => {
    const unlabeled = Object.entries(entityFieldMetadata).flatMap(([entityName, fields]) =>
      fields.filter((field) => !field.label && !field.rawLabel).map((field) => `${entityName}.${field.name}`),
    );

    expect(unlabeled).toEqual([]);
  });

  it('only points at a suggestions source on fields flagged as suggestions', () => {
    const inconsistent = Object.entries(entityFieldMetadata).flatMap(([entityName, fields]) =>
      fields
        .filter((field) => Boolean(field.suggestionsSource) !== Boolean(field.isSuggestion))
        .map((field) => `${entityName}.${field.name}`),
    );

    expect(inconsistent).toEqual([]);
  });
});

/**
 * `globalSearchFieldConfig` names columns as plain strings and é usado para montar LIKEs; um
 * rename de campo que esqueça este arquivo só apareceria como "a busca global parou de achar
 * X". Amarrar as duas tabelas de metadados pega esse drift no teste.
 */
describe('globalSearchFieldConfig', () => {
  it.each(globalSearchEntities)('%s has matching entity field metadata', (entityName) => {
    expect(entityFieldMetadata[entityName]).toBeDefined();
  });

  it.each(globalSearchEntities)('%s searches only fields declared in the entity metadata', (entityName) => {
    const declared = new Set(entityFieldMetadata[entityName].map((field) => field.name));
    const { titleField, searchFields } = globalSearchFieldConfig[entityName];

    expect(declared).toContain(titleField);
    expect(searchFields.filter((field) => !declared.has(field))).toEqual([]);
  });

  it.each(globalSearchEntities)('%s only LIKE-matches string fields', (entityName) => {
    const typeByField = new Map(entityFieldMetadata[entityName].map((field) => [field.name, field.type]));
    const nonString = globalSearchFieldConfig[entityName].searchFields.filter(
      (field) => typeByField.get(field) !== 'string',
    );

    expect(nonString).toEqual([]);
  });

  it.each(globalSearchEntities)('%s does not repeat search fields', (entityName) => {
    const { searchFields } = globalSearchFieldConfig[entityName];
    expect(new Set(searchFields).size).toBe(searchFields.length);
  });
});
