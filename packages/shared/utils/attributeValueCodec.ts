import { AttributeType } from '../metadata/AttributeType';

/**
 * `AttributeValue.value` (e `StorySchemaField.defaultValue`) são sempre uma única coluna de
 * texto, decodificada de acordo com `AttributeType` - não 4 colunas tipadas. Isso mantém a
 * tabela idêntica em SQLite e Postgres e evita migração de dados se um tipo for reinterpretado
 * no futuro, mas exige que number/boolean nunca sejam comparados como texto cru contra um valor
 * já tipado (o Postgres rejeita `text = integer`) - por isso esta é a ÚNICA função que sabe
 * codificar/decodificar cada tipo; nenhum outro ponto do código deve reimplementar isso.
 */
export function encodeAttributeValue(
  type: AttributeType,
  raw: string | number | boolean | null | undefined,
): string | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  switch (type) {
    case AttributeType.BOOLEAN:
      return (typeof raw === 'boolean' ? raw : raw === 'true' || raw === '1') ? 'true' : 'false';
    case AttributeType.NUMBER: {
      const numeric = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(numeric) ? String(numeric) : null;
    }
    default:
      return String(raw);
  }
}

export function decodeAttributeValue(
  type: AttributeType,
  stored: string | null | undefined,
): string | number | boolean | null {
  if (stored === null || stored === undefined || stored === '') {
    return null;
  }
  switch (type) {
    case AttributeType.BOOLEAN:
      return stored === 'true';
    case AttributeType.NUMBER: {
      const numeric = Number(stored);
      return Number.isFinite(numeric) ? numeric : null;
    }
    default:
      return stored;
  }
}
