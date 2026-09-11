import type { PackSelectionType } from '@keres/shared';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StorySelect } from '../../db/schema';
import type { PackService } from '../../services/storymanagement/PackService';
import { useNotificationStore } from '../../state/notificationStore';

const ALL_OFF: PackSelectionType = {
  customAttributes: false,
  suggestions: false,
  suggestionsIncludeUsed: false,
  stats: false,
  tags: false,
};

type UsePackFormStateOptions = {
  initialPackId?: string;
  packServiceRef: RefObject<PackService | null>;
  stories: StorySelect[];
};

/** Owns field state and initial pack hydration for a Pack form. */
export function usePackFormState({
  initialPackId,
  packServiceRef,
  stories,
}: UsePackFormStateOptions) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [sourceStoryId, setSourceStoryId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [selection, setSelection] = useState<PackSelectionType>(ALL_OFF);
  const [loading, setLoading] = useState(true);
  const isEditing = !!initialPackId;

  useEffect(() => {
    (async () => {
      if (!initialPackId) {
        setLoading(false);
        return;
      }
      try {
        if (!packServiceRef.current) {
          setLoading(false);
          return;
        }
        const pack = (await packServiceRef.current.listPacks()).find(
          (entry) => entry.id === initialPackId,
        );
        if (pack) {
          setName(pack.name);
          setDescription(pack.description ?? '');
          setLanguage(pack.language ?? '');
          setAuthorName(pack.authorName ?? '');
          setSourceStoryId(pack.sourceStoryId);
        }
      } catch (error) {
        console.error('PackFormScreen: failed to load.', error);
        showNotification(t('packs_load_failed'), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [initialPackId, packServiceRef, showNotification, t]);

  /**
   * Prefills from the story the moment one is chosen, and only while creating: on a re-extraction
   * the author has already edited these, and overwriting their choice would be surprising.
   */
  const chooseStory = useCallback(
    (storyId: string) => {
      setSourceStoryId(storyId);
      if (initialPackId) return;
      const story = stories.find((entry) => entry.id === storyId);
      if (!story) return;
      setLanguage(story.language ?? '');
      setAuthorName(story.author ?? '');
      if (!name.trim()) setName(story.title);
    },
    [initialPackId, stories, name],
  );

  const toggle = useCallback(
    (key: keyof PackSelectionType) => (value: boolean) =>
      setSelection((current) => ({
        ...current,
        [key]: value,
        // The sub-toggle cannot outlive its parent, or a pack would claim to sweep in used values
        // while carrying no catalogue at all.
        ...(key === 'suggestions' && !value ? { suggestionsIncludeUsed: false } : {}),
      })),
    [],
  );

  const nothingSelected = useMemo(
    () =>
      !selection.customAttributes && !selection.suggestions && !selection.stats && !selection.tags,
    [selection],
  );

  return {
    initialPackId,
    sourceStoryId,
    setSourceStoryId,
    name,
    setName,
    description,
    setDescription,
    language,
    setLanguage,
    authorName,
    setAuthorName,
    selection,
    setSelection,
    chooseStory,
    toggle,
    nothingSelected,
    loading,
    isEditing,
  };
}

export type PackFormState = ReturnType<typeof usePackFormState>;
