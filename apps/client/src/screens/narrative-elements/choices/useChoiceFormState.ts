import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDurableFormDraft } from '../../../hooks/useDurableFormDraft';
import type { ChoiceService } from '../../../services/storymanagement/ChoiceService';

type UseChoiceFormStateOptions = {
  initialChoiceId?: string;
  initialSceneId?: string;
  storyId?: string;
  choiceServiceRef: RefObject<ChoiceService | null>;
};

export type ChoiceFormDraftFields = {
  sceneId: string | null;
  nextSceneId: string | null;
  text: string;
  notes: string | null;
};

const CREATE_PRISTINE: ChoiceFormDraftFields = {
  sceneId: null,
  nextSceneId: null,
  text: '',
  notes: null,
};

function isChoiceFormDraftFields(value: unknown): value is ChoiceFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return (
    (fields.sceneId === null || typeof fields.sceneId === 'string') &&
    (fields.nextSceneId === null || typeof fields.nextSceneId === 'string') &&
    typeof fields.text === 'string' &&
    (fields.notes === null || typeof fields.notes === 'string')
  );
}

/** Owns field state and initial choice hydration for a Choice form. */
export function useChoiceFormState({
  initialChoiceId,
  initialSceneId,
  storyId,
  choiceServiceRef,
}: UseChoiceFormStateOptions) {
  const [currentChoiceId, setCurrentChoiceId] = useState<string | undefined>(initialChoiceId);
  const [sceneId, setSceneId] = useState<string | null>(initialSceneId ?? null);
  const [nextSceneId, setNextSceneId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [notes, setNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<ChoiceFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const isEditing = !!currentChoiceId;
  const retainPersistedChoiceId = useCallback((choiceId: string) => {
    setCurrentChoiceId(choiceId);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!choiceServiceRef.current || !storyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (initialChoiceId) {
          const fetchedChoice = await choiceServiceRef.current.getById(initialChoiceId);
          if (fetchedChoice) {
            setSceneId(fetchedChoice.sceneId);
            setNextSceneId(fetchedChoice.nextSceneId);
            setText(fetchedChoice.text);
            setNotes(fetchedChoice.notes);
            setLoadedPristine({
              sceneId: fetchedChoice.sceneId,
              nextSceneId: fetchedChoice.nextSceneId,
              text: fetchedChoice.text,
              notes: fetchedChoice.notes,
            });
            setLoadedUpdatedAt(fetchedChoice.updatedAt?.toISOString?.() ?? null);
          } else {
            console.warn('Choice not found:', initialChoiceId);
          }
        }
      } catch (err) {
        console.error('Failed to load choice:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [initialChoiceId, choiceServiceRef, storyId]);

  // A scene prefill is the starting point, not a change: reset keeps it and no draft is
  // written until the user actually types.
  const createPristine = useMemo(
    () => ({ ...CREATE_PRISTINE, sceneId: initialSceneId ?? null }),
    [initialSceneId],
  );

  const restoreDraftFields = useCallback((fields: ChoiceFormDraftFields) => {
    if (!isChoiceFormDraftFields(fields)) {
      console.error('Corrupt choice form draft ignored.');
      return;
    }
    setSceneId(fields.sceneId);
    setNextSceneId(fields.nextSceneId);
    setText(fields.text);
    setNotes(fields.notes);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<ChoiceFormDraftFields>({
      storyId,
      entityType: 'Choice',
      entityId: initialChoiceId,
      enabled: !!storyId && !loading,
      snapshot: { sceneId, nextSceneId, text, notes },
      pristine: loadedPristine ?? createPristine,
      baseUpdatedAt: initialChoiceId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? createPristine;
  const isDirty =
    JSON.stringify({ sceneId, nextSceneId, text, notes }) !== JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again. Secondary queues keep their own lifecycle and are
   * untouched.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? createPristine;
    setSceneId(target.sceneId);
    setNextSceneId(target.nextSceneId);
    setText(target.text);
    setNotes(target.notes);
    await deleteStoredDraft();
  }, [loadedPristine, createPristine, deleteStoredDraft]);

  return {
    currentChoiceId,
    retainPersistedChoiceId,
    sceneId,
    setSceneId,
    nextSceneId,
    setNextSceneId,
    text,
    setText,
    notes,
    setNotes,
    loading,
    isEditing,
    clearFormDraft,
    draftRestored,
    isDirty,
    resetForm,
  };
}

export type ChoiceFormState = ReturnType<typeof useChoiceFormState>;
