import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '../../db';
import { useDurableFormDraft } from '../../hooks/useDurableFormDraft';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { readEntityFormSecondaryDraft } from '../../services/storymanagement/EntityFormSecondaryDraftStore';
import type { NoteService } from '../../services/storymanagement/NoteService';

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
  const [title, setTitle] = useState('');
  const [body, setBody] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
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
            setTitle(fetchedNote.title);
            setBody(fetchedNote.body);
            setIsFavorite(fetchedNote.isFavorite);
            setExtraNotes(fetchedNote.extraNotes);
            setLoadedPristine({
              title: fetchedNote.title,
              body: fetchedNote.body,
              isFavorite: fetchedNote.isFavorite,
              extraNotes: fetchedNote.extraNotes,
            });
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
            console.warn('Note not found:', initialNoteId);
          }
        }
      } catch (err) {
        console.error('Failed to load note:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [drizzleDb, initialNoteId, noteServiceRef, storyId]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const restoreDraftFields = useCallback((fields: NoteFormDraftFields) => {
    if (!isNoteFormDraftFields(fields)) {
      console.error('Corrupt note form draft ignored.');
      return;
    }
    setTitle(fields.title);
    setBody(fields.body);
    setIsFavorite(fields.isFavorite);
    setExtraNotes(fields.extraNotes);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<NoteFormDraftFields>({
      storyId,
      entityType: 'Note',
      entityId: initialNoteId,
      enabled: !!storyId && !loading,
      snapshot: { title, body, isFavorite, extraNotes },
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: initialNoteId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? CREATE_PRISTINE;
  const isDirty =
    JSON.stringify({ title, body, isFavorite, extraNotes }) !== JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again. Secondary queues (tags, notes, relations, customs)
   * keep their own lifecycle and are untouched.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? CREATE_PRISTINE;
    setTitle(target.title);
    setBody(target.body);
    setIsFavorite(target.isFavorite);
    setExtraNotes(target.extraNotes);
    await deleteStoredDraft();
  }, [loadedPristine, deleteStoredDraft]);

  return {
    currentNoteId,
    retainPersistedNoteId,
    title,
    setTitle,
    body,
    setBody,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
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
