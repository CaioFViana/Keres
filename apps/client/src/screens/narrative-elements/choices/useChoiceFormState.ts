import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { ChoiceService } from '../../../services/storymanagement/ChoiceService';

type UseChoiceFormStateOptions = {
  initialChoiceId?: string;
  initialSceneId?: string;
  storyId?: string;
  choiceServiceRef: RefObject<ChoiceService | null>;
};

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
  };
}

export type ChoiceFormState = ReturnType<typeof useChoiceFormState>;
