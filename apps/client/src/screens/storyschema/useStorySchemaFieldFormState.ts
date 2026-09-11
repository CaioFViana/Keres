import type { StorySchemaEntityType } from '@keres/shared';
import { AttributeType, deriveAttributeKey } from '@keres/shared';
import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StorySchemaFieldService } from '../../services/storymanagement/StorySchemaFieldService';
import { AppAlert } from '../../utils/AppAlert';

type UseStorySchemaFieldFormStateOptions = {
  initialFieldId?: string;
  storySchemaFieldServiceRef: RefObject<StorySchemaFieldService | null>;
  onFieldMissing(): void;
};

/** Owns field state and initial hydration for a StorySchemaField form. */
export function useStorySchemaFieldFormState({
  initialFieldId,
  storySchemaFieldServiceRef,
  onFieldMissing,
}: UseStorySchemaFieldFormStateOptions) {
  const { t } = useTranslation();
  const isEditing = !!initialFieldId;

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [description, setDescription] = useState<string | null>(null);
  const [type, setType] = useState<AttributeType>(AttributeType.TEXT);
  const [targetEntityType, setTargetEntityType] = useState<StorySchemaEntityType | null>(null);
  const [isRequired, setIsRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        if (!storySchemaFieldServiceRef.current) {
          setLoading(false);
          return;
        }
        const field = await storySchemaFieldServiceRef.current.getById(initialFieldId!);
        if (field) {
          setName(field.name);
          setKey(field.key);
          setKeyManuallyEdited(true);
          setDescription(field.description);
          setType(field.type as AttributeType);
          setTargetEntityType(field.targetEntityType as StorySchemaEntityType | null);
          setIsRequired(field.isRequired);
          setDefaultValue(field.defaultValue);
        } else {
          AppAlert.alert(t('error'), t('attribute_not_found'));
          onFieldMissing();
        }
      } catch (err) {
        console.error('Failed to load attribute field:', err);
        AppAlert.alert(t('error'), t('failed_to_load_attribute'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, initialFieldId, storySchemaFieldServiceRef, onFieldMissing, t]);

  const handleNameChange = (text: string) => {
    setName(text);
    if (!keyManuallyEdited) {
      setKey(deriveAttributeKey(text));
    }
  };

  const handleKeyChange = (text: string) => {
    setKeyManuallyEdited(true);
    setKey(text.toLowerCase());
  };

  return {
    name,
    key,
    description,
    setDescription,
    type,
    setType,
    targetEntityType,
    setTargetEntityType,
    isRequired,
    setIsRequired,
    defaultValue,
    setDefaultValue,
    loading,
    isEditing,
    handleNameChange,
    handleKeyChange,
  };
}

export type StorySchemaFieldFormState = ReturnType<typeof useStorySchemaFieldFormState>;
