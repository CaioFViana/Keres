import type { StorySchemaEntityType } from '@keres/shared';
import { AttributeType, deriveAttributeKey } from '@keres/shared';
import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDurableFormDraft } from '../../hooks/useDurableFormDraft';
import type { StorySchemaFieldService } from '../../services/storymanagement/StorySchemaFieldService';
import { AppAlert } from '../../utils/AppAlert';

type UseStorySchemaFieldFormStateOptions = {
  initialFieldId?: string;
  storyId?: string;
  storySchemaFieldServiceRef: RefObject<StorySchemaFieldService | null>;
  onFieldMissing(): void;
};

export type StorySchemaFieldFormDraftFields = {
  name: string;
  key: string;
  keyManuallyEdited: boolean;
  description: string | null;
  type: AttributeType;
  targetEntityType: StorySchemaEntityType | null;
  isRequired: boolean;
  defaultValue: string | null;
};

const CREATE_PRISTINE: StorySchemaFieldFormDraftFields = {
  name: '',
  key: '',
  keyManuallyEdited: false,
  description: null,
  type: AttributeType.TEXT,
  targetEntityType: null,
  isRequired: false,
  defaultValue: null,
};

function isStorySchemaFieldFormDraftFields(value: unknown): value is StorySchemaFieldFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return (
    typeof fields.name === 'string' &&
    typeof fields.key === 'string' &&
    typeof fields.keyManuallyEdited === 'boolean' &&
    (fields.description === null || typeof fields.description === 'string') &&
    typeof fields.type === 'string' &&
    (fields.targetEntityType === null || typeof fields.targetEntityType === 'string') &&
    typeof fields.isRequired === 'boolean' &&
    (fields.defaultValue === null || typeof fields.defaultValue === 'string')
  );
}

/** Owns field state and initial hydration for a StorySchemaField form. */
export function useStorySchemaFieldFormState({
  initialFieldId,
  storyId,
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
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<StorySchemaFieldFormDraftFields | null>(
    null,
  );
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);

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
          setLoadedPristine({
            name: field.name,
            key: field.key,
            keyManuallyEdited: true,
            description: field.description,
            type: field.type as AttributeType,
            targetEntityType: field.targetEntityType as StorySchemaEntityType | null,
            isRequired: field.isRequired,
            defaultValue: field.defaultValue,
          });
          setLoadedUpdatedAt(field.updatedAt?.toISOString?.() ?? null);
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

  const restoreDraftFields = useCallback((fields: StorySchemaFieldFormDraftFields) => {
    if (!isStorySchemaFieldFormDraftFields(fields)) {
      console.error('Corrupt story schema field form draft ignored.');
      return;
    }
    // Raw setters, not the handlers: restore must not re-slug or force the manual flag.
    setName(fields.name);
    setKey(fields.key);
    setKeyManuallyEdited(fields.keyManuallyEdited);
    setDescription(fields.description);
    setType(fields.type);
    setTargetEntityType(fields.targetEntityType);
    setIsRequired(fields.isRequired);
    setDefaultValue(fields.defaultValue);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<StorySchemaFieldFormDraftFields>({
      storyId,
      entityType: 'StorySchemaField',
      entityId: initialFieldId,
      enabled: !!storyId && !loading,
      snapshot: {
        name,
        key,
        keyManuallyEdited,
        description,
        type,
        targetEntityType,
        isRequired,
        defaultValue,
      },
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: initialFieldId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? CREATE_PRISTINE;
  const isDirty =
    JSON.stringify({
      name,
      key,
      keyManuallyEdited,
      description,
      type,
      targetEntityType,
      isRequired,
      defaultValue,
    }) !== JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? CREATE_PRISTINE;
    setName(target.name);
    setKey(target.key);
    setKeyManuallyEdited(target.keyManuallyEdited);
    setDescription(target.description);
    setType(target.type);
    setTargetEntityType(target.targetEntityType);
    setIsRequired(target.isRequired);
    setDefaultValue(target.defaultValue);
    await deleteStoredDraft();
  }, [loadedPristine, deleteStoredDraft]);

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
    clearFormDraft,
    draftRestored,
    isDirty,
    resetForm,
  };
}

export type StorySchemaFieldFormState = ReturnType<typeof useStorySchemaFieldFormState>;
