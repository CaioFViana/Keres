import { AttributeType, isSuggestionAttributeType } from '@keres/shared';
import { FieldType, EntityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { StorySchemaFieldSelect } from '../db/schema';
import { customAttributeSuggestionType } from '../services/storymanagement/SuggestionService';

function mapAttributeTypeToFieldType(type: string): FieldType {
  switch (type) {
    case AttributeType.NUMBER:
      return 'number';
    case AttributeType.BOOLEAN:
      return 'boolean';
    case AttributeType.DATE:
      return 'date';
    case AttributeType.ENTITY:
      return 'entity';
    default:
      // TEXT, LONG_TEXT, SUGGESTION, SUGGESTION_LIST - rendered/matched as free text.
      return 'string';
  }
}

/**
 * Converte os campos customizados de um Story Schema em `EntityFieldMetadata` sintéticos, pro
 * `AdvancedSearchModal`/per-service query loops tratarem exatamente como um campo nativo -
 * `entityFieldMetadata` (o registro estático) nunca é mutado, isto só é concatenado a ele no
 * ponto de uso. `name` usa o `fieldId` (não a `key` legível) pra sobreviver a uma renomeação.
 */
export function buildCustomAttributeFieldMetadata(
  fields: StorySchemaFieldSelect[],
): EntityFieldMetadata[] {
  return fields.map((field) => ({
    name: `custom:${field.id}`,
    label: field.name,
    rawLabel: field.name,
    type: mapAttributeTypeToFieldType(field.type),
    isSearchable: true,
    isSuggestion: isSuggestionAttributeType(field.type),
    suggestionsSource: isSuggestionAttributeType(field.type)
      ? customAttributeSuggestionType(field.id)
      : undefined,
    entityTargetType: field.targetEntityType,
  }));
}

/** Prefixo usado por `buildCustomAttributeFieldMetadata` - usado pelos serviços pra distinguir
 *  uma chave de critério de busca "campo customizado" (precisa de subquery em AttributeValue)
 *  de uma chave "campo nativo" (coluna direta na própria tabela). */
export const CUSTOM_FIELD_METADATA_PREFIX = 'custom:';

export function extractCustomFieldId(metadataName: string): string | null {
  return metadataName.startsWith(CUSTOM_FIELD_METADATA_PREFIX)
    ? metadataName.slice(CUSTOM_FIELD_METADATA_PREFIX.length)
    : null;
}
