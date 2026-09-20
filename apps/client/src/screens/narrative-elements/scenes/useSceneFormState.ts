import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppDrizzleClient, SceneSelect } from '../../../db';
import { useDurableFormDraft } from '../../../hooks/useDurableFormDraft';
import { createAttributeValueService } from '../../../services/storymanagement/AttributeValueService';
import { readEntityFormSecondaryDraft } from '../../../services/storymanagement/EntityFormSecondaryDraftStore';
import type { SceneService } from '../../../services/storymanagement/SceneService';
import type { StorySchemaField } from '@keres/shared';

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
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [gapInput, setGapInput] = useState('');
  const [gapType, setGapType] = useState<string | null>(null);
  const [calendarDateOverride, setCalendarDateOverride] = useState('');
  const [calendarDateOverrideCalendarId, setCalendarDateOverrideCalendarId] = useState<
    string | null
  >(null);
  const [durationInput, setDurationInput] = useState('');
  const [durationType, setDurationType] = useState<string | null>(null);
  const [isStart, setIsStart] = useState(false);
  const [isFinish, setIsFinish] = useState(false);
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
    const applyScene = (scene: SceneSelect) => {
      setChapterId(scene.chapterId);
      setLocationId(scene.locationId);
      setName(scene.name);
      setSummary(scene.summary);
      setIsFavorite(scene.isFavorite);
      setExtraNotes(scene.extraNotes);
      setGapInput(scene.gap === null ? '' : String(scene.gap));
      setGapType(scene.gapType);
      setCalendarDateOverride(scene.calendarDateOverride ?? '');
      setCalendarDateOverrideCalendarId(scene.calendarDateOverrideCalendarId);
      setDurationInput(scene.duration === null ? '' : String(scene.duration));
      setDurationType(scene.durationType);
      setIsStart(scene.isStart);
      setIsFinish(scene.isFinish);
      setLoadedPristine({
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
      });
      setLoadedUpdatedAt(scene.updatedAt?.toISOString?.() ?? null);
    };

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
            applyScene(scene);
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
          setChapterId(initialChapterId);
        }
      } catch (error) {
        console.error('Failed to load scene:', error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [drizzleDb, initialChapterId, initialSceneId, sceneServiceRef, storyId]);

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

  const restoreDraftFields = useCallback((fields: SceneFormDraftFields) => {
    if (!isSceneFormDraftFields(fields)) {
      console.error('Corrupt scene form draft ignored.');
      return;
    }
    setChapterId(fields.chapterId);
    setLocationId(fields.locationId);
    setName(fields.name);
    setSummary(fields.summary);
    setIsFavorite(fields.isFavorite);
    setExtraNotes(fields.extraNotes);
    setGapInput(fields.gapInput);
    setGapType(fields.gapType);
    setCalendarDateOverride(fields.calendarDateOverride);
    setCalendarDateOverrideCalendarId(fields.calendarDateOverrideCalendarId);
    setDurationInput(fields.durationInput);
    setDurationType(fields.durationType);
    setIsStart(fields.isStart);
    setIsFinish(fields.isFinish);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<SceneFormDraftFields>({
      storyId,
      entityType: 'Scene',
      entityId: initialSceneId,
      enabled: !!storyId && !loading,
      snapshot: {
        chapterId,
        locationId,
        name,
        summary,
        isFavorite,
        extraNotes,
        gapInput,
        gapType,
        calendarDateOverride,
        calendarDateOverrideCalendarId,
        durationInput,
        durationType,
        isStart,
        isFinish,
      },
      pristine: loadedPristine ?? createPristine,
      baseUpdatedAt: initialSceneId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? createPristine;
  const isDirty =
    JSON.stringify({
      chapterId,
      locationId,
      name,
      summary,
      isFavorite,
      extraNotes,
      gapInput,
      gapType,
      calendarDateOverride,
      calendarDateOverrideCalendarId,
      durationInput,
      durationType,
      isStart,
      isFinish,
    }) !== JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again. Secondary queues (tags, notes, relations, customs)
   * keep their own lifecycle and are untouched.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? createPristine;
    setChapterId(target.chapterId);
    setLocationId(target.locationId);
    setName(target.name);
    setSummary(target.summary);
    setIsFavorite(target.isFavorite);
    setExtraNotes(target.extraNotes);
    setGapInput(target.gapInput);
    setGapType(target.gapType);
    setCalendarDateOverride(target.calendarDateOverride);
    setCalendarDateOverrideCalendarId(target.calendarDateOverrideCalendarId);
    setDurationInput(target.durationInput);
    setDurationType(target.durationType);
    setIsStart(target.isStart);
    setIsFinish(target.isFinish);
    await deleteStoredDraft();
  }, [loadedPristine, createPristine, deleteStoredDraft]);

  return {
    currentSceneId,
    retainPersistedSceneId,
    chapterId,
    setChapterId,
    locationId,
    setLocationId,
    name,
    setName,
    summary,
    setSummary,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
    gapInput,
    setGapInput,
    gapType,
    setGapType,
    calendarDateOverride,
    setCalendarDateOverride,
    calendarDateOverrideCalendarId,
    setCalendarDateOverrideCalendarId,
    durationInput,
    setDurationInput,
    durationType,
    setDurationType,
    isStart,
    setIsStart,
    isFinish,
    setIsFinish,
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
