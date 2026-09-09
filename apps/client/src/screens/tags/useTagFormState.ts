import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TagService } from '../../services/storymanagement/TagService';

type UseTagFormStateOptions = {
  tagId?: string;
  tagServiceRef: RefObject<TagService | null>;
};

/** Owns field state and initial tag hydration for a Tag form. */
export function useTagFormState({ tagId, tagServiceRef }: UseTagFormStateOptions) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isEditing = !!tagId;

  useEffect(() => {
    const loadTag = async () => {
      setLoadError(null);
      if (!isEditing) {
        setLoading(false);
        return;
      }
      if (!tagServiceRef.current || !tagId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const fetchedTag = await tagServiceRef.current.getById(tagId);
        if (fetchedTag) {
          setName(fetchedTag.name);
          setColor(fetchedTag.color || '');
          setIsFavorite(fetchedTag.isFavorite);
          setExtraNotes(fetchedTag.extraNotes);
        } else {
          setLoadError(t('tag_data_missing'));
          console.warn('Tag not found:', tagId);
        }
      } catch (err) {
        setLoadError(t('tag_data_missing'));
        console.error('Failed to load tag:', err);
      } finally {
        setLoading(false);
      }
    };
    void loadTag();
  }, [tagId, isEditing, tagServiceRef, t]);

  return {
    tagId,
    name,
    setName,
    color,
    setColor,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
    loading,
    loadError,
    isEditing,
  };
}

export type TagFormState = ReturnType<typeof useTagFormState>;
