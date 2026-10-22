import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '@/src/db';
import { useDurableFormDraft } from '@/src/hooks/forms/useDurableFormDraft';
import { fieldsDiffer, pickFields, useFormFields } from '@/src/hooks/forms/useFormFields';
import { createAttributeValueService } from '@/src/services/storymanagement/entities/AttributeValueService';
import { readEntityFormSecondaryDraft } from '@/src/state/drafts/entityFormSecondaryDraftStore';
import type { NoteService } from '@/src/services/storymanagement/notes-tags-comments/NoteService';
import { logger } from '@/src/utils/logging/logger';

type UseNoteFormStateOptions = {
  initialNoteId?: string;
  storyId?: string;
  drizzleDb: AppDrizzleClient;
  noteServiceRef: RefObject<NoteService | null>;
  customFields: StorySchemaField[];
};

export type NoteFormDraftFields = {
  title: string;
  body: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
};

const CREATE_PRISTINE: NoteFormDraftFields = {
  title: '',
  body: null,
  isFavorite: false,
  extraNotes: null,
};

const FIELD_KEYS = Object.keys(CREATE_PRISTINE) as (keyof NoteFormDraftFields)[];

function isNoteFormDraftFields(value: unknown): value is NoteFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return (
    typeof fields.title === 'string' &&
    (fields.body === null || typeof fields.body === 'string') &&
    typeof fields.isFavorite === 'boolean' &&
    (fields.extraNotes === null || typeof fields.extraNotes === 'string')
  );
}

/** Owns field state, initial note hydration and defaults for a Note form. */
export function useNoteFormState({
  initialNoteId,
  storyId,
  drizzleDb,
  noteServiceRef,
  customFields,
}: UseNoteFormStateOptions) {
  const [currentNoteId, setCurrentNoteId] = useState<string | undefined>(initialNoteId);
  const { fields, setters, setAll } = useFormFields(CREATE_PRISTINE);
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const [loading, setLoading] = useState(true);
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<NoteFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const customDefaultsAppliedRef = useRef(false);
  const isEditing = !!currentNoteId;
  const retainPersistedNoteId = useCallback((noteId: string) => {
    setCurrentNoteId(noteId);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!noteServiceRef.current || !storyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (initialNoteId) {
          const fetchedNote = await noteServiceRef.current.getById(initialNoteId);
          if (fetchedNote) {
            const row = pickFields(fetchedNote, FIELD_KEYS);
            setAll(row);
            setLoadedPristine(row);
            setLoadedUpdatedAt(fetchedNote.updatedAt?.toISOString?.() ?? null);

            const existingValues =
              await createAttributeValueService(drizzleDb).getValuesForEntity(initialNoteId);
            const fromDb = Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value]));
            const draft = await readEntityFormSecondaryDraft(storyId, 'Note', initialNoteId);
            setCustomValues(
              draft && Object.keys(draft.customValues).length > 0
                ? { ...fromDb, ...draft.customValues }
                : fromDb,
            );
          } else {
            logger.warn('Note not found:', initialNoteId);
          }
        }
      } catch (err) {
        logger.error('Failed to load note:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [drizzleDb, initialNoteId, noteServiceRef, setAll, storyId]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const restoreDraftFields = useCallback(
    (restored: NoteFormDraftFields) => {
      if (!isNoteFormDraftFields(restored)) {
        logger.error('Corrupt note form draft ignored.');
        return;
      }
      setAll({ ...CREATE_PRISTINE, ...restored });
    },
    [setAll],
  );

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<NoteFormDraftFields>({
      storyId,
      entityType: 'Note',
      entityId: initialNoteId,
      enabled: !!storyId && !loading,
      snapshot: fields,
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: initialNoteId ? loadedUpdatedAt : undefined,
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
    currentNoteId,
    retainPersistedNoteId,
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

export type NoteFormState = ReturnType<typeof useNoteFormState>;
