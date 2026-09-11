import { useEffect, useState } from 'react';
import type { StatSelect } from '../../db/schema';

type UseStatFormStateOptions = {
  statId?: string;
  stats: StatSelect[];
};

/** Owns field state and initial stat hydration for a Stat form. */
export function useStatFormState({ statId, stats }: UseStatFormStateOptions) {
  const isEditing = !!statId;
  const [name, setName] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [loading, setLoading] = useState(isEditing);

  useEffect(() => {
    if (!statId) return;
    const stat = stats.find((row) => row.id === statId);
    if (!stat) return;
    setName(stat.name);
    setIsPrimary(stat.isPrimary);
    setLoading(false);
  }, [stats, statId]);

  return {
    statId,
    name,
    setName,
    isPrimary,
    setIsPrimary,
    loading,
    isEditing,
  };
}

export type StatFormState = ReturnType<typeof useStatFormState>;
