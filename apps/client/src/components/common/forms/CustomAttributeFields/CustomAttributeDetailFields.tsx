import { AttributeType, CommentEntityType, decodeAttributeValue, StorySchemaEntityType } from '@keres/shared';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../../../../db';
import { createAttributeValueService } from '../../../../services/storymanagement/AttributeValueService';
import { entityEventEmitter } from '../../../../utils/EventEmitter';
import { useEntityComments } from '../../../../hooks/useEntityComments';
import { useStorySchemaFields } from '../../../../hooks/useStorySchemaFields';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';

interface CustomAttributeDetailFieldsProps {
  storyId: string;
  entityType: StorySchemaEntityType;
  entityId: string;
}

function formatValueForDisplay(type: AttributeType | string, decoded: string | number | boolean | null, t: (key: string) => string): string {
  if (decoded === null) {
    return t('common_na');
  }
  if (typeof decoded === 'boolean') {
    return decoded ? t('common_yes') : t('common_no');
  }
  return String(decoded);
}

/**
 * Renderiza os atributos customizados de um Story Schema na tela de detalhe, mesmo padrão
 * visual (`DetailField`) já usado pelos campos nativos - um único componente reaproveitado
 * pelos 7 tipos de entidade, na mesma posição em toda tela: depois dos campos nativos, antes de
 * galeria/relações.
 */
const CustomAttributeDetailFields: React.FC<CustomAttributeDetailFieldsProps> = ({ storyId, entityType, entityId }) => {
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const fields = useStorySchemaFields(storyId, entityType);
  const [values, setValues] = useState<Record<string, string | null>>({});
  const {
    commentsByField, canComment, isStoryOwner, currentUserId, addComment, deleteComment, updateComment,
  } = useEntityComments(storyId, entityType as CommentEntityType, entityId);

  const fetchValues = useCallback(async () => {
    try {
      const service = createAttributeValueService(drizzleDb);
      const rows = await service.getValuesForEntity(entityId);
      setValues(Object.fromEntries(rows.map((row) => [row.fieldId, row.value])));
    } catch (error) {
      console.error('Failed to load attribute values:', error);
      setValues({});
    }
  }, [drizzleDb, entityId]);

  useEffect(() => {
    fetchValues();
    entityEventEmitter.on('attribute_value_changed', fetchValues);
    return () => {
      entityEventEmitter.off('attribute_value_changed', fetchValues);
    };
  }, [fetchValues]);

  if (fields.length === 0) {
    return null;
  }

  return (
    <>
      {fields.map((field) => {
        // Entidades que já existiam antes do campo ser criado não têm valor próprio - caem no
        // defaultValue do campo (o mais honesto disponível) em vez de mostrar N/A à toa.
        const rawValue = values[field.id] ?? field.defaultValue ?? null;
        const decoded = decodeAttributeValue(field.type as AttributeType, rawValue);
        const displayValue = formatValueForDisplay(field.type, decoded, t);
        return (
          <CommentableDetailField
            key={field.id}
            storyId={storyId}
            label={field.name}
            value={displayValue}
            comments={commentsByField[field.id] ?? []}
            canComment={canComment}
            isStoryOwner={isStoryOwner}
            currentUserId={currentUserId}
            onAddComment={(input) => addComment({ fieldId: field.id }, { ...input, contentSnapshot: displayValue })}
            onDeleteComment={deleteComment}
            onUpdateComment={updateComment}
          />
        );
      })}
    </>
  );
};

export default CustomAttributeDetailFields;
