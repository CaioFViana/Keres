/**
 * @jest-environment node
 */
import { AttributeType } from '@keres/shared';
import {
  buildCustomAttributeFieldMetadata,
  CUSTOM_FIELD_METADATA_PREFIX,
  extractCustomFieldId,
} from '../../src/utils/customAttributeFieldMetadata';

const field = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'field-1',
    storyId: 'story-1',
    name: 'Tipo de poder',
    key: 'tipo_de_poder',
    type: AttributeType.TEXT,
    entityType: 'Character',
    ...overrides,
  }) as never;

/**
 * Os campos customizados de um Story Schema viram `EntityFieldMetadata` sintéticos, tratados
 * pela busca avançada exatamente como um campo nativo. O `name` usa o `fieldId` e não a chave
 * legível justamente para sobreviver a uma renomeação do campo pelo usuário.
 */
describe('buildCustomAttributeFieldMetadata', () => {
  it('names the synthetic field after the field id, not the readable key', () => {
    const [metadata] = buildCustomAttributeFieldMetadata([
      field({ id: 'abc', key: 'tipo_de_poder' }),
    ]);

    expect(metadata.name).toBe('custom:abc');
  });

  it('carries the user-typed label as a resolved string, since it has no translation key', () => {
    const [metadata] = buildCustomAttributeFieldMetadata([field({ name: 'Tipo de poder' })]);

    expect(metadata.rawLabel).toBe('Tipo de poder');
    expect(metadata.label).toBe('Tipo de poder');
  });

  it('marks every custom field as searchable', () => {
    const [metadata] = buildCustomAttributeFieldMetadata([field()]);

    expect(metadata.isSearchable).toBe(true);
  });

  it.each([
    [AttributeType.NUMBER, 'number'],
    [AttributeType.BOOLEAN, 'boolean'],
    [AttributeType.DATE, 'date'],
    [AttributeType.TEXT, 'string'],
    [AttributeType.LONG_TEXT, 'string'],
    [AttributeType.SUGGESTION, 'string'],
    [AttributeType.ENTITY, 'entity'],
  ])('renders %s as a %s input', (attributeType, expected) => {
    const [metadata] = buildCustomAttributeFieldMetadata([field({ type: attributeType })]);

    expect(metadata.type).toBe(expected);
  });

  it('wires a suggestion field to its own suggestions source', () => {
    const [metadata] = buildCustomAttributeFieldMetadata([
      field({ id: 'abc', type: AttributeType.SUGGESTION }),
    ]);

    expect(metadata.isSuggestion).toBe(true);
    expect(metadata.suggestionsSource).toBe('custom:abc');
  });

  it('keeps an entity field target for the entity picker', () => {
    const [metadata] = buildCustomAttributeFieldMetadata([
      field({ type: AttributeType.ENTITY, targetEntityType: 'Character' }),
    ]);

    expect(metadata).toMatchObject({ type: 'entity', entityTargetType: 'Character' });
  });

  it('leaves a non-suggestion field without a suggestions source', () => {
    const [metadata] = buildCustomAttributeFieldMetadata([field({ type: AttributeType.TEXT })]);

    expect(metadata.isSuggestion).toBe(false);
    expect(metadata.suggestionsSource).toBeUndefined();
  });

  it('keeps the order of the fields it was given', () => {
    const metadata = buildCustomAttributeFieldMetadata([
      field({ id: 'a', name: 'Alfa' }),
      field({ id: 'b', name: 'Beta' }),
    ]);

    expect(metadata.map((entry) => entry.rawLabel)).toEqual(['Alfa', 'Beta']);
  });

  it('returns nothing for a story with no custom fields', () => {
    expect(buildCustomAttributeFieldMetadata([])).toEqual([]);
  });
});

describe('extractCustomFieldId', () => {
  it('reads the field id back out of a synthetic metadata name', () => {
    expect(extractCustomFieldId('custom:abc')).toBe('abc');
  });

  it('round-trips with what the builder produced', () => {
    const [metadata] = buildCustomAttributeFieldMetadata([
      field({ id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }),
    ]);

    expect(extractCustomFieldId(metadata.name)).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV');
  });

  it.each(['name', 'isFavorite', 'extraNotes'])(
    'returns null for the native field %s',
    (nativeField) => {
      expect(extractCustomFieldId(nativeField)).toBeNull();
    },
  );

  it('does not treat the prefix appearing mid-string as a custom field', () => {
    expect(extractCustomFieldId('naocustom:abc')).toBeNull();
  });

  it('exposes the prefix the services match on', () => {
    expect(CUSTOM_FIELD_METADATA_PREFIX).toBe('custom:');
  });
});
