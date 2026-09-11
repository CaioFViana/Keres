import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '../../db';
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
  };
}

export type NoteFormState = ReturnType<typeof useNoteFormState>;
