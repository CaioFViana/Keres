import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { StorySchemaField } from '@keres/shared';
import type { WorldPieceSection } from '@keres/shared/entities/narrative/WorldRule';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '@/src/db';
import { useDurableFormDraft } from '@/src/hooks/forms/useDurableFormDraft';
import { fieldsDiffer, pickFields, useFormFields } from '@/src/hooks/forms/useFormFields';
import { createAttributeValueService } from '@/src/services/storymanagement/entities/AttributeValueService';
import { readEntityFormSecondaryDraft } from '@/src/state/drafts/entityFormSecondaryDraftStore';
import type { WorldRuleService } from '@/src/services/storymanagement/entities/WorldRuleService';
import { logger } from '@/src/utils/logging/logger';

type UseWorldRuleFormStateOptions = {
  initialWorldRuleId?: string;
  storyId?: string;
  drizzleDb: AppDrizzleClient;
  worldRuleServiceRef: RefObject<WorldRuleService | null>;
  customFields: StorySchemaField[];
};

export type WorldRuleFormDraftFields = {
  title: string;
  description: string | null;
  section: WorldPieceSection;
  type: string | null;
  category: string | null;
  behavior: string | null;
  usability: string | null;
  danger: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
};

const CREATE_PRISTINE: WorldRuleFormDraftFields = {
  title: '',
  description: null,
  section: 'rule',
  type: null,
  category: null,
  behavior: null,
  usability: null,
  danger: null,
  isFavorite: false,
  extraNotes: null,
};

const FIELD_KEYS = Object.keys(CREATE_PRISTINE) as (keyof WorldRuleFormDraftFields)[];

function isWorldRuleFormDraftFields(value: unknown): value is WorldRuleFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return (
    typeof fields.title === 'string' &&
    (fields.description === null || typeof fields.description === 'string') &&
    typeof fields.section === 'string' &&
    (fields.type === null || typeof fields.type === 'string') &&
    (fields.category === null || typeof fields.category === 'string') &&
    (fields.behavior === null || typeof fields.behavior === 'string') &&
    (fields.usability === null || typeof fields.usability === 'string') &&
    (fields.danger === null || typeof fields.danger === 'string') &&
    typeof fields.isFavorite === 'boolean' &&
    (fields.extraNotes === null || typeof fields.extraNotes === 'string')
  );
}

/** Owns field state, initial world-rule hydration and defaults for a WorldRule form. */
export function useWorldRuleFormState({
  initialWorldRuleId,
  storyId,
  drizzleDb,
  worldRuleServiceRef,
  customFields,
}: UseWorldRuleFormStateOptions) {
  const [currentWorldRuleId, setCurrentWorldRuleId] = useState<string | undefined>(
    initialWorldRuleId,
  );
  const { fields, setters, setAll } = useFormFields(CREATE_PRISTINE);
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const [loading, setLoading] = useState(true);
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<WorldRuleFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const customDefaultsAppliedRef = useRef(false);
  const isEditing = !!currentWorldRuleId;
  const retainPersistedWorldRuleId = useCallback((worldRuleId: string) => {
    setCurrentWorldRuleId(worldRuleId);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!worldRuleServiceRef.current || !storyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (initialWorldRuleId) {
          const fetchedWorldRule = await worldRuleServiceRef.current.getById(initialWorldRuleId);
          if (fetchedWorldRule) {
            const picked = pickFields(fetchedWorldRule, FIELD_KEYS);
            const row = { ...picked, section: picked.section as WorldPieceSection };
            setAll(row);
            setLoadedPristine(row);
            setLoadedUpdatedAt(fetchedWorldRule.updatedAt?.toISOString?.() ?? null);

            const existingValues =
              await createAttributeValueService(drizzleDb).getValuesForEntity(initialWorldRuleId);
            const fromDb = Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value]));
            const draft = await readEntityFormSecondaryDraft(
              storyId,
              'WorldRule',
              initialWorldRuleId,
            );
            setCustomValues(
              draft && Object.keys(draft.customValues).length > 0
                ? { ...fromDb, ...draft.customValues }
                : fromDb,
            );
          } else {
            logger.warn('World rule not found:', initialWorldRuleId);
          }
        }
      } catch (err) {
        logger.error('Failed to load world rule:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [drizzleDb, initialWorldRuleId, worldRuleServiceRef, setAll, storyId]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const restoreDraftFields = useCallback(
    (restored: WorldRuleFormDraftFields) => {
      if (!isWorldRuleFormDraftFields(restored)) {
        logger.error('Corrupt world rule form draft ignored.');
        return;
      }
      setAll({ ...CREATE_PRISTINE, ...restored });
    },
    [setAll],
  );

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<WorldRuleFormDraftFields>({
      storyId,
      entityType: 'WorldRule',
      entityId: initialWorldRuleId,
      enabled: !!storyId && !loading,
      snapshot: fields,
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: initialWorldRuleId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? CREATE_PRISTINE;
  const isDirty = fieldsDiffer(fields, pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again. Secondary queues (tags, notes, relations, customs)
   * keep their own lifecycle and are untouched.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? CREATE_PRISTINE;
    setAll(target);
    await deleteStoredDraft();
  }, [loadedPristine, deleteStoredDraft, setAll]);

  return {
    currentWorldRuleId,
    retainPersistedWorldRuleId,
    ...fields,
    ...setters,
    customValues,
    setCustomValues,
    loading,
    isEditing,
    clearFormDraft,
    draftRestored,
    isDirty,
    resetForm,
  };
}

export type WorldRuleFormState = ReturnType<typeof useWorldRuleFormState>;
