import { useCallback, useEffect, useState } from 'react';
import type { StatSelect } from '../../db/schema';
import { useDurableFormDraft } from '../../hooks/useDurableFormDraft';

type UseStatFormStateOptions = {
  statId?: string;
  storyId?: string;
  stats: StatSelect[];
};

export type StatFormDraftFields = {
  name: string;
  isPrimary: boolean;
};

const CREATE_PRISTINE: StatFormDraftFields = {
  name: '',
  isPrimary: true,
};

function isStatFormDraftFields(value: unknown): value is StatFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return typeof fields.name === 'string' && typeof fields.isPrimary === 'boolean';
}

/** Owns field state and initial stat hydration for a Stat form. */
export function useStatFormState({ statId, storyId, stats }: UseStatFormStateOptions) {
  const isEditing = !!statId;
  const [name, setName] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [loading, setLoading] = useState(isEditing);
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<StatFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!statId) return;
    const stat = stats.find((row) => row.id === statId);
    if (!stat) return;
    setName(stat.name);
    setIsPrimary(stat.isPrimary);
    setLoadedPristine({ name: stat.name, isPrimary: stat.isPrimary });
    setLoadedUpdatedAt(stat.updatedAt?.toISOString?.() ?? null);
    setLoading(false);
  }, [stats, statId]);

  const restoreDraftFields = useCallback((fields: StatFormDraftFields) => {
    if (!isStatFormDraftFields(fields)) {
      console.error('Corrupt stat form draft ignored.');
      return;
    }
    setName(fields.name);
    setIsPrimary(fields.isPrimary);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<StatFormDraftFields>({
      storyId,
      entityType: 'Stat',
      entityId: statId,
      enabled: !!storyId && !loading,
      snapshot: { name, isPrimary },
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: statId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? CREATE_PRISTINE;
  const isDirty = JSON.stringify({ name, isPrimary }) !== JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? CREATE_PRISTINE;
    setName(target.name);
    setIsPrimary(target.isPrimary);
    await deleteStoredDraft();
  }, [loadedPristine, deleteStoredDraft]);

  return {
    statId,
    name,
    setName,
    isPrimary,
    setIsPrimary,
    loading,
    isEditing,
    clearFormDraft,
    draftRestored,
    isDirty,
    resetForm,
  };
}

export type StatFormState = ReturnType<typeof useStatFormState>;
