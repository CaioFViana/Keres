import { useCallback } from 'react';
import { useDrizzle } from '../db';
import { useSyncConflictStore } from '../state/syncConflictStore';

/** Closes the store's db argument so conflict sheets do not import the database. */
export function useSyncConflictActions() {
  const db = useDrizzle();
  const keepLocalStore = useSyncConflictStore((state) => state.keepLocal);
  const keepServerStore = useSyncConflictStore((state) => state.keepServer);
  const keepServerAndCloneBoardStore = useSyncConflictStore(
    (state) => state.keepServerAndCloneBoard,
  );
  const isResolving = useSyncConflictStore((state) => state.isResolving);

  const keepLocal = useCallback(
    (conflictId: string, chosenValues?: Record<string, any>) =>
      keepLocalStore(db, conflictId, chosenValues),
    [db, keepLocalStore],
  );
  const keepServer = useCallback(
    (conflictId: string) => keepServerStore(db, conflictId),
    [db, keepServerStore],
  );
  const keepServerAndCloneBoard = useCallback(
    (conflictId: string, currentUserId: string, cloneName: string) =>
      keepServerAndCloneBoardStore(db, conflictId, currentUserId, cloneName),
    [db, keepServerAndCloneBoardStore],
  );

  return { isResolving, keepLocal, keepServer, keepServerAndCloneBoard };
}
