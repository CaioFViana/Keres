import type {
  CommentEntityType,
  StorySchemaEntityType} from '@keres/shared';
import {
  AttributeType,
  decodeAttributeValue,
  formatAttributeDateForDisplay,
  joinSuggestionListForDisplay
} from '@keres/shared';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../../../../db';
import { createAttributeValueService } from '../../../../services/storymanagement/AttributeValueService';
import { EntityService } from '../../../../services/EntityService';
import { entityEventEmitter } from '../../../../utils/EventEmitter';
import { useEntityComments } from '../../../../hooks/useEntityComments';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import { useStorySchemaFields } from '../../../../hooks/useStorySchemaFields';
import { useUserSettingsStore } from '../../../../state/userSettingsStore';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';

interface CustomAttributeDetailFieldsProps {
  storyId: string;
  entityType: StorySchemaEntityType;
  entityId: string;
}

function formatValueForDisplay(
  type: AttributeType | string,
  decoded: string | number | boolean | string[] | null,
  t: (key: string) => string,
  language: string,
  use24HourTime: boolean,
): string {
  if (decoded === null) {
    return t('common_na');
  }
  if (Array.isArray(decoded) || type === AttributeType.SUGGESTION_LIST) {
    return joinSuggestionListForDisplay(Array.isArray(decoded) ? decoded : null) ?? t('common_na');
  }
  if (typeof decoded === 'boolean') {
    return decoded ? t('common_yes') : t('common_no');
  }
  if (type === AttributeType.DATE) {
    // Dia da semana + data por extenso no idioma do APP (nunca o do dispositivo), sempre igual
    // em qualquer fuso - ver `attributeDateValue.ts`. A hora segue o formato 24h/AM-PM escolhido
    // em Configurações. Valores de texto livre gravados antes do date picker existir não são
    // canônicos: aparecem crus em vez de sumir.
    return (
      formatAttributeDateForDisplay(String(decoded), language, use24HourTime) ?? String(decoded)
    );
  }
  return String(decoded);
}

/**
 * Renderiza os atributos customizados de um Story Schema na tela de detalhe, mesmo padrão
 * visual (`DetailField`) já usado pelos campos nativos - um único componente reaproveitado
 * pelos 7 tipos de entidade, na mesma posição em toda tela: depois dos campos nativos, antes de
 * galeria/relações.
 */
const CustomAttributeDetailFields: React.FC<CustomAttributeDetailFieldsProps> = ({
  storyId,
  entityType,
  entityId,
}) => {
  const { t, i18n } = useTranslation();
  const use24HourTime = useUserSettingsStore((state) => state.use24HourTime);
  const navigateToDetail = useNavigateToEntityDetail();
  const drizzleDb = useDrizzle();
  const fields = useStorySchemaFields(storyId, entityType);
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [resolvedEntityNames, setResolvedEntityNames] = useState<Record<string, string>>({});
  const {
    commentsByField,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    deleteComment,
    updateComment,
  } = useEntityComments(storyId, entityType as CommentEntityType, entityId);

  const fetchValues = useCallback(async () => {
    try {
      const service = createAttributeValueService(drizzleDb);
      const rows = await service.getValuesForEntity(entityId);
      const loadedValues = Object.fromEntries(rows.map((row) => [row.fieldId, row.value]));
      setValues(loadedValues);

      const names = await Promise.all(
        fields
          .filter(
            (field) =>
              field.type === AttributeType.ENTITY &&
              field.targetEntityType &&
              loadedValues[field.id],
          )
          .map(async (field) => {
            const name = await EntityService.getEntityIdentifier(
              drizzleDb,
              field.targetEntityType!,
              loadedValues[field.id]!,
              storyId,
              t,
            );
            return [field.id, name] as const;
          }),
      );
      setResolvedEntityNames(
        Object.fromEntries(
          names.filter((entry): entry is readonly [string, string] => entry[1] !== undefined),
        ),
      );
    } catch (error) {
      console.error('Failed to load attribute values:', error);
      setValues({});
      setResolvedEntityNames({});
    }
  }, [drizzleDb, entityId, fields, storyId, t]);

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
        const isEntityReference = field.type === AttributeType.ENTITY;
        const resolvedEntityName = resolvedEntityNames[field.id];
        const displayValue =
          isEntityReference && rawValue
            ? resolvedEntityName || t('attribute_entity_deleted')
            : formatValueForDisplay(field.type, decoded, t, i18n.language, use24HourTime);
        const onPress =
          isEntityReference && resolvedEntityName && field.targetEntityType && rawValue
            ? () => {
                navigateToDetail(field.targetEntityType as StorySchemaEntityType, rawValue);
              }
            : undefined;
        return (
          <CommentableDetailField
            key={field.id}
            storyId={storyId}
            label={field.name}
            value={displayValue}
            onPress={onPress}
            comments={commentsByField[field.id] ?? []}
            canComment={canComment}
            isStoryOwner={isStoryOwner}
            currentUserId={currentUserId}
            onAddComment={(input) =>
              addComment({ fieldId: field.id }, { ...input, contentSnapshot: displayValue })
            }
            onDeleteComment={deleteComment}
            onUpdateComment={updateComment}
          />
        );
      })}
    </>
  );
};

export default CustomAttributeDetailFields;
