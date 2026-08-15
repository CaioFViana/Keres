import { AttributeType } from '../metadata/AttributeType';
import { StorySchemaEntityType } from '../metadata/StorySchemaEntityType';

/**
 * Definição de um atributo customizado, compartilhada por toda entidade de `entityType` dentro
 * de `storyId` - nunca por instância individual. `key` é imutável após a criação (só
 * `name`/`description`/`isRequired`/`defaultValue`/`order` são editáveis); `AttributeValue`
 * referencia esta linha por `fieldId`, então renomear `name` nunca desconecta valores já salvos.
 */
export interface StorySchemaField {
  id: string;
  storyId: string;
  entityType: StorySchemaEntityType;
  /** Nome de exibição, editável. */
  name: string;
  /** lowercase snake_case, único dentro de (storyId, entityType), imutável após criação. */
  key: string;
  description: string | null;
  type: AttributeType;
  /** Alvo fixo de um atributo ENTITY; imutÃ¡vel apÃ³s a criaÃ§Ã£o, como key e entityType. */
  targetEntityType: StorySchemaEntityType | null;
  isRequired: boolean;
  /** Sempre texto puro, igual a `AttributeValue.value` - ver `attributeValueCodec.ts`. */
  defaultValue: string | null;
  /** Ordem de exibição em forms/details, crescente. Não é editável. Não é tão importante pra editar ordem! */
  order: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
