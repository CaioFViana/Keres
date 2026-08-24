import { AttributeType } from '@keres/shared';
import type { SQL } from 'drizzle-orm';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import { attributeValues, storySchemaFields } from '../db/schema';
import { extractCustomFieldId } from './customAttributeFieldMetadata';

/**
 * Constrói a condição WHERE para uma chave de critério de busca avançada que referencia um
 * atributo customizado (`custom:<fieldId>`) - mesma forma da subquery já usada para filtro por
 * tag em cada serviço (`inArray(entity.id, db.select(...).from(...))`), só que contra a tabela
 * EAV `attributeValues` em vez de uma relação fixa.
 *
 * Retorna `null` se `key` não for um critério de atributo customizado, ou se o campo referenciado
 * não existir mais - o chamador simplesmente ignora a condição nesses casos, mesmo tratamento
 * que um `fieldMetadata` não encontrado já recebe hoje.
 *
 * Number/boolean nunca comparam o texto cru de `attributeValues.value` contra o valor tipado
 * recebido do formulário de busca - sempre pela mesma codificação de `encodeAttributeValue`
 * (implícita aqui via `String(Number(...))`/`'true'|'false'`), a razão está documentada em
 * `packages/shared/utils/attributeValueCodec.ts`.
 */
export async function buildCustomAttributeSearchCondition(
  db: AppDrizzleClient,
  entityIdColumn: any,
  key: string,
  rawValue: any,
): Promise<SQL<boolean> | null> {
  const fieldId = extractCustomFieldId(key);
  if (!fieldId) {
    return null;
  }

  const field = await db.query.storySchemaFields.findFirst({
    where: and(eq(storySchemaFields.id, fieldId), eq(storySchemaFields.isDeleted, false)),
  });
  if (!field) {
    return null;
  }

  let valuePredicate: SQL<boolean>;
  switch (field.type as AttributeType) {
    case AttributeType.NUMBER: {
      const numeric = Number(rawValue);
      if (!Number.isFinite(numeric)) {
        return null;
      }
      valuePredicate = eq(attributeValues.value, String(numeric)) as SQL<boolean>;
      break;
    }
    case AttributeType.BOOLEAN:
      valuePredicate = eq(
        attributeValues.value,
        rawValue === true || rawValue === 'true' ? 'true' : 'false',
      ) as SQL<boolean>;
      break;
    case AttributeType.ENTITY:
      valuePredicate = eq(attributeValues.value, String(rawValue)) as SQL<boolean>;
      break;
    default:
      // text, long_text, date, suggestion - substring match, same treatment native string/date
      // fields already get.
      valuePredicate =
        sql`${attributeValues.value} LIKE ${`%${rawValue}%`} COLLATE NOCASE` as SQL<boolean>;
      break;
  }

  const matchingEntityIds = db
    .select({ entityId: attributeValues.entityId })
    .from(attributeValues)
    .where(
      and(
        eq(attributeValues.fieldId, fieldId),
        eq(attributeValues.isDeleted, false),
        valuePredicate,
      ),
    );

  return inArray(entityIdColumn, matchingEntityIds) as SQL<boolean>;
}
