import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { eq } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import { storySchemaFields } from '../db/schema';

/**
 * Resolve o rótulo amigável e traduzido de um campo de comentário: para campos nativos,
 * usa `entityFieldMetadata` (mesma fonte usada pela Busca Avançada); para atributos
 * customizados (`fieldId`), busca `StorySchemaField.name` (definido pelo usuário, sem
 * chave de tradução). Cai no `fieldKey`/`fieldId` cru só se nada for encontrado.
 */
export function useCommentFieldLabel(entityType: string, fieldKey: string | null, fieldId: string | null): string {
  const { t } = useTranslation();
  const db = useDrizzle();
  const [customFieldName, setCustomFieldName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!fieldId) {
      setCustomFieldName(null);
      return;
    }
    db.query.storySchemaFields.findFirst({
      where: eq(storySchemaFields.id, fieldId),
      columns: { name: true },
    }).then((field) => {
      if (!cancelled) setCustomFieldName(field?.name ?? null);
    }).catch(() => {
      if (!cancelled) setCustomFieldName(null);
    });
    return () => { cancelled = true; };
  }, [db, fieldId]);

  if (fieldId) {
    return customFieldName || fieldId;
  }

  const nativeField = entityFieldMetadata[entityType]?.find((field) => field.name === fieldKey);
  if (nativeField) {
    return nativeField.rawLabel || t(nativeField.label);
  }

  return fieldKey || '';
}
