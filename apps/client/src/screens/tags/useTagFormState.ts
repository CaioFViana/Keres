import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDurableFormDraft } from '../../hooks/useDurableFormDraft';
import type { TagService } from '../../services/storymanagement/TagService';

type UseTagFormStateOptions = {
  tagId?: string;
  storyId?: string;
  tagServiceRef: RefObject<TagService | null>;
};

export type TagFormDraftFields = {
  name: string;
  color: string;
  isFavorite: boolean;
  extraNotes: string | null;
};

const CREATE_PRISTINE: TagFormDraftFields = {
  name: '',
  color: '',
  isFavorite: false,
  extraNotes: null,
};

function isTagFormDraftFields(value: unknown): value is TagFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return (
    typeof fields.name === 'string' &&
    typeof fields.color === 'string' &&
    typeof fields.isFavorite === 'boolean' &&
    (fields.extraNotes === null || typeof fields.extraNotes === 'string')
  );
}

/** Owns field state and initial tag hydration for a Tag form. */
export function useTagFormState({ tagId, storyId, tagServiceRef }: UseTagFormStateOptions) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<TagFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
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
          setLoadedPristine({
            name: fetchedTag.name,
            color: fetchedTag.color || '',
            isFavorite: fetchedTag.isFavorite,
            extraNotes: fetchedTag.extraNotes,
          });
          setLoadedUpdatedAt(fetchedTag.updatedAt?.toISOString?.() ?? null);
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

  const restoreDraftFields = useCallback((fields: TagFormDraftFields) => {
    if (!isTagFormDraftFields(fields)) {
      console.error('Corrupt tag form draft ignored.');
      return;
    }
    setName(fields.name);
    setColor(fields.color);
    setIsFavorite(fields.isFavorite);
    setExtraNotes(fields.extraNotes);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<TagFormDraftFields>({
      storyId,
      entityType: 'Tag',
      entityId: tagId,
      enabled: !!storyId && !loading,
      snapshot: { name, color, isFavorite, extraNotes },
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: tagId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? CREATE_PRISTINE;
  const isDirty =
    JSON.stringify({ name, color, isFavorite, extraNotes }) !== JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? CREATE_PRISTINE;
    setName(target.name);
    setColor(target.color);
    setIsFavorite(target.isFavorite);
    setExtraNotes(target.extraNotes);
    await deleteStoredDraft();
  }, [loadedPristine, deleteStoredDraft]);

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
    clearFormDraft,
    draftRestored,
    isDirty,
    resetForm,
  };
}

export type TagFormState = ReturnType<typeof useTagFormState>;
