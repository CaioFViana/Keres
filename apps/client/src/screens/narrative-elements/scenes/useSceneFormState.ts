import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppDrizzleClient, SceneSelect } from '@/src/db';
import { useDurableFormDraft } from '@/src/hooks/forms/useDurableFormDraft';
import { fieldsDiffer, useFormFields } from '@/src/hooks/forms/useFormFields';
import { createAttributeValueService } from '@/src/services/storymanagement/entities/AttributeValueService';
import { readEntityFormSecondaryDraft } from '@/src/state/drafts/entityFormSecondaryDraftStore';
import type { SceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';
import type { StorySchemaField } from '@keres/shared';
import { logger } from '@/src/utils/logging/logger';

type UseSceneFormStateOptions = {
  initialSceneId?: string;
  initialChapterId?: string;
  storyId?: string;
  drizzleDb: AppDrizzleClient;
  sceneServiceRef: RefObject<SceneService | null>;
  customFields: StorySchemaField[];
};

export type SceneFormDraftFields = {
  chapterId: string | null;
  locationId: string | null;
  name: string;
  summary: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
  gapInput: string;
  gapType: string | null;
  calendarDateOverride: string;
  calendarDateOverrideCalendarId: string | null;
  durationInput: string;
  durationType: string | null;
  isStart: boolean;
  isFinish: boolean;
};

const CREATE_PRISTINE: SceneFormDraftFields = {
  chapterId: null,
  locationId: null,
  name: '',
  summary: null,
  isFavorite: false,
  extraNotes: null,
  gapInput: '',
  gapType: null,
  calendarDateOverride: '',
  calendarDateOverrideCalendarId: null,
  durationInput: '',
  durationType: null,
  isStart: false,
  isFinish: false,
};

/** The numbers are typed as text in the form, and an unset one is a blank field. */
function sceneToFields(scene: SceneSelect): SceneFormDraftFields {
  return {
    chapterId: scene.chapterId,
    locationId: scene.locationId,
    name: scene.name,
    summary: scene.summary,
    isFavorite: scene.isFavorite,
    extraNotes: scene.extraNotes,
    gapInput: scene.gap === null ? '' : String(scene.gap),
    gapType: scene.gapType,
    calendarDateOverride: scene.calendarDateOverride ?? '',
    calendarDateOverrideCalendarId: scene.calendarDateOverrideCalendarId,
    durationInput: scene.duration === null ? '' : String(scene.duration),
    durationType: scene.durationType,
    isStart: scene.isStart,
    isFinish: scene.isFinish,
  };
}

function isSceneFormDraftFields(value: unknown): value is SceneFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return (
    (fields.chapterId === null || typeof fields.chapterId === 'string') &&
    (fields.locationId === null || typeof fields.locationId === 'string') &&
    typeof fields.name === 'string' &&
    (fields.summary === null || typeof fields.summary === 'string') &&
    typeof fields.isFavorite === 'boolean' &&
    (fields.extraNotes === null || typeof fields.extraNotes === 'string') &&
    typeof fields.gapInput === 'string' &&
    (fields.gapType === null || typeof fields.gapType === 'string') &&
    typeof fields.calendarDateOverride === 'string' &&
    (fields.calendarDateOverrideCalendarId === null ||
      typeof fields.calendarDateOverrideCalendarId === 'string') &&
    typeof fields.durationInput === 'string' &&
    (fields.durationType === null || typeof fields.durationType === 'string') &&
    typeof fields.isStart === 'boolean' &&
    typeof fields.isFinish === 'boolean'
  );
}

/** Owns field state, initial scene hydration and defaults for a Scene form. */
export function useSceneFormState({
  initialSceneId,
  initialChapterId,
  storyId,
  drizzleDb,
  sceneServiceRef,
  customFields,
}: UseSceneFormStateOptions) {
  const [currentSceneId, setCurrentSceneId] = useState<string | undefined>(initialSceneId);
  const { fields, setters, setAll } = useFormFields(CREATE_PRISTINE);
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const [loading, setLoading] = useState(true);
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<SceneFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const customDefaultsAppliedRef = useRef(false);
  const isEditing = !!currentSceneId;
  const retainPersistedSceneId = useCallback((sceneId: string) => {
    setCurrentSceneId(sceneId);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!sceneServiceRef.current || !storyId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        if (initialSceneId) {
          const scene = await sceneServiceRef.current.getById(initialSceneId);
          if (scene) {
            const row = sceneToFields(scene);
            setAll(row);
            setLoadedPristine(row);
            setLoadedUpdatedAt(scene.updatedAt?.toISOString?.() ?? null);
            const values =
              await createAttributeValueService(drizzleDb).getValuesForEntity(initialSceneId);
            const fromDb = Object.fromEntries(values.map((value) => [value.fieldId, value.value]));
            const draft = await readEntityFormSecondaryDraft(storyId, 'Scene', initialSceneId);
            setCustomValues(
              draft && Object.keys(draft.customValues).length > 0
                ? { ...fromDb, ...draft.customValues }
                : fromDb,
            );
          }
        } else if (initialChapterId) {
          setters.setChapterId(initialChapterId);
        }
      } catch (error) {
        logger.error('Failed to load scene:', error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [drizzleDb, initialChapterId, initialSceneId, sceneServiceRef, setAll, setters, storyId]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  // A chapter prefill is the starting point, not a change: reset keeps it and no draft is
  // written until the user actually types.
  const createPristine = useMemo(
    () => ({ ...CREATE_PRISTINE, chapterId: initialChapterId ?? null }),
    [initialChapterId],
  );

  const restoreDraftFields = useCallback(
    (restored: SceneFormDraftFields) => {
      if (!isSceneFormDraftFields(restored)) {
        logger.error('Corrupt scene form draft ignored.');
        return;
      }
      setAll(restored);
    },
    [setAll],
  );

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<SceneFormDraftFields>({
      storyId,
      entityType: 'Scene',
      entityId: initialSceneId,
      enabled: !!storyId && !loading,
      snapshot: fields,
      pristine: loadedPristine ?? createPristine,
      baseUpdatedAt: initialSceneId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? createPristine;
  const isDirty = fieldsDiffer(fields, pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again. Secondary queues (tags, notes, relations, customs)
   * keep their own lifecycle and are untouched.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? createPristine;
    setAll(target);
    await deleteStoredDraft();
  }, [loadedPristine, createPristine, deleteStoredDraft, setAll]);

  return {
    currentSceneId,
    retainPersistedSceneId,
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

export type SceneFormState = ReturnType<typeof useSceneFormState>;
