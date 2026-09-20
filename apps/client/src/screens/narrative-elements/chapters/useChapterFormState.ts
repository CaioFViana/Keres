import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppDrizzleClient } from '../../../db';
import { useDurableFormDraft } from '../../../hooks/useDurableFormDraft';
import { createAttributeValueService } from '../../../services/storymanagement/AttributeValueService';
import { readEntityFormSecondaryDraft } from '../../../services/storymanagement/EntityFormSecondaryDraftStore';
import type { ChapterService } from '../../../services/storymanagement/ChapterService';

type UseChapterFormStateOptions = {
  initialChapterId?: string;
  storyId?: string;
  activeArcId?: string | null;
  drizzleDb: AppDrizzleClient;
  chapterServiceRef: RefObject<ChapterService | null>;
  customFields: StorySchemaField[];
};

export type ChapterFormDraftFields = {
  name: string;
  summary: string | null;
  isFavorite: boolean;
  isEvent: boolean;
  extraNotes: string | null;
  arcId: string | null;
};

const CREATE_PRISTINE: ChapterFormDraftFields = {
  name: '',
  summary: null,
  isFavorite: false,
  isEvent: false,
  extraNotes: null,
  arcId: null,
};

function isChapterFormDraftFields(value: unknown): value is ChapterFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return (
    typeof fields.name === 'string' &&
    (fields.summary === null || typeof fields.summary === 'string') &&
    typeof fields.isFavorite === 'boolean' &&
    typeof fields.isEvent === 'boolean' &&
    (fields.extraNotes === null || typeof fields.extraNotes === 'string') &&
    (fields.arcId === null || typeof fields.arcId === 'string')
  );
}

/** Owns field state, initial chapter hydration and defaults for a Chapter form. */
export function useChapterFormState({
  initialChapterId,
  storyId,
  activeArcId,
  drizzleDb,
  chapterServiceRef,
  customFields,
}: UseChapterFormStateOptions) {
  const [currentChapterId, setCurrentChapterId] = useState<string | undefined>(initialChapterId);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  // Only chosen at creation; changing it afterwards is a conversion - see `ChapterDetailScreen`.
  const [isEvent, setIsEvent] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [arcId, setArcId] = useState<string | null>(activeArcId ?? null);
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const [loading, setLoading] = useState(true);
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<ChapterFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const customDefaultsAppliedRef = useRef(false);
  const isEditing = !!currentChapterId;
  const retainPersistedChapterId = useCallback((chapterId: string) => {
    setCurrentChapterId(chapterId);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!chapterServiceRef.current || !storyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (initialChapterId) {
          const fetchedChapter = await chapterServiceRef.current.getById(initialChapterId);
          if (fetchedChapter) {
            setName(fetchedChapter.name);
            setSummary(fetchedChapter.summary);
            setIsFavorite(fetchedChapter.isFavorite);
            setExtraNotes(fetchedChapter.extraNotes);
            setIsEvent(fetchedChapter.type === 'event');
            setArcId(fetchedChapter.arcId ?? null);
            setLoadedPristine({
              name: fetchedChapter.name,
              summary: fetchedChapter.summary,
              isFavorite: fetchedChapter.isFavorite,
              isEvent: fetchedChapter.type === 'event',
              extraNotes: fetchedChapter.extraNotes,
              arcId: fetchedChapter.arcId ?? null,
            });
            setLoadedUpdatedAt(fetchedChapter.updatedAt?.toISOString?.() ?? null);

            const existingValues =
              await createAttributeValueService(drizzleDb).getValuesForEntity(initialChapterId);
            const fromDb = Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value]));
            const draft = await readEntityFormSecondaryDraft(storyId, 'Chapter', initialChapterId);
            setCustomValues(
              draft && Object.keys(draft.customValues).length > 0
                ? { ...fromDb, ...draft.customValues }
                : fromDb,
            );
          } else {
            console.warn('Chapter not found:', initialChapterId);
          }
        }
      } catch (err) {
        console.error('Failed to load chapter:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [drizzleDb, initialChapterId, chapterServiceRef, storyId]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  // An active-arc prefill is the starting point, not a change: reset keeps it and no draft is
  // written until the user actually types.
  const createPristine = useMemo(
    () => ({ ...CREATE_PRISTINE, arcId: activeArcId ?? null }),
    [activeArcId],
  );

  const restoreDraftFields = useCallback((fields: ChapterFormDraftFields) => {
    if (!isChapterFormDraftFields(fields)) {
      console.error('Corrupt chapter form draft ignored.');
      return;
    }
    setName(fields.name);
    setSummary(fields.summary);
    setIsFavorite(fields.isFavorite);
    setIsEvent(fields.isEvent);
    setExtraNotes(fields.extraNotes);
    setArcId(fields.arcId);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<ChapterFormDraftFields>({
      storyId,
      entityType: 'Chapter',
      entityId: initialChapterId,
      enabled: !!storyId && !loading,
      snapshot: { name, summary, isFavorite, isEvent, extraNotes, arcId },
      pristine: loadedPristine ?? createPristine,
      baseUpdatedAt: initialChapterId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? createPristine;
  const isDirty =
    JSON.stringify({ name, summary, isFavorite, isEvent, extraNotes, arcId }) !==
    JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again. Secondary queues (tags, notes, relations, customs)
   * keep their own lifecycle and are untouched.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? createPristine;
    setName(target.name);
    setSummary(target.summary);
    setIsFavorite(target.isFavorite);
    setIsEvent(target.isEvent);
    setExtraNotes(target.extraNotes);
    setArcId(target.arcId);
    await deleteStoredDraft();
  }, [loadedPristine, createPristine, deleteStoredDraft]);

  return {
    currentChapterId,
    retainPersistedChapterId,
    name,
    setName,
    summary,
    setSummary,
    isFavorite,
    setIsFavorite,
    isEvent,
    setIsEvent,
    extraNotes,
    setExtraNotes,
    arcId,
    setArcId,
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

export type ChapterFormState = ReturnType<typeof useChapterFormState>;
