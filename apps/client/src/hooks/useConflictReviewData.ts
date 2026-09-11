import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import {
  buildConflictSummaries,
  collectConflictEntityRefs,
  collectEntityRefs,
} from '../services/ConflictSummaryService';
import {
  createEntityNameBatchResolver,
  createEntitySnapshotResolver,
} from '../services/EntityNameBatchResolver';
import type { PendingConflict } from '../services/SyncConflictService';

export function useConflictReviewData(conflicts: PendingConflict[]) {
  const { t } = useTranslation();
  const db = useDrizzle();
  const [snapshots, setSnapshots] = useState<Map<string, Record<string, any>>>(new Map());
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const snapshotRefs = collectConflictEntityRefs(conflicts);
    if (snapshotRefs.length === 0) {
      setSnapshots(new Map());
      setNames(new Map());
      return;
    }
    (async () => {
      const resolvedSnapshots = await createEntitySnapshotResolver(db).resolveMany(snapshotRefs);
      if (cancelled) return;
      setSnapshots(resolvedSnapshots);

      const nameRefs = collectEntityRefs(conflicts, resolvedSnapshots);
      if (nameRefs.length === 0) {
        setNames(new Map());
        return;
      }
      const resolvedNames = await createEntityNameBatchResolver(db).resolveMany(nameRefs);
      if (!cancelled) setNames(resolvedNames);
    })().catch((error) => {
      console.log('SyncConflictReviewSheet: failed to resolve entity names.', error);
    });
    return () => {
      cancelled = true;
    };
  }, [conflicts, db]);

  const summaries = useMemo(
    () => buildConflictSummaries(conflicts, snapshots, names, t),
    [conflicts, names, snapshots, t],
  );

  return { summaries };
}
