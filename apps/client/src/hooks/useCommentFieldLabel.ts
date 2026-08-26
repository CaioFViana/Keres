import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { eq } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import { storySchemaFields } from '../db/schema';

/**
 * Resolves a comment field's friendly, translated label: for native fields it uses
 * `entityFieldMetadata` (the same source Advanced Search uses); for custom attributes (`fieldId`) it
 * looks up `StorySchemaField.name` (defined by the user, with no translation key). It falls back to the
 * raw `fieldKey`/`fieldId` only if nothing is found.
 */
export function useCommentFieldLabel(
  entityType: string,
  fieldKey: string | null,
  fieldId: string | null,
): string {
  const { t } = useTranslation();
  const db = useDrizzle();
  const [customFieldName, setCustomFieldName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!fieldId) {
      setCustomFieldName(null);
      return;
    }
    db.query.storySchemaFields
      .findFirst({
        where: eq(storySchemaFields.id, fieldId),
        columns: { name: true },
      })
      .then((field) => {
        if (!cancelled) setCustomFieldName(field?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setCustomFieldName(null);
      });
    return () => {
      cancelled = true;
    };
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
