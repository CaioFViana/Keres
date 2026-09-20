import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearBoundEditorDraft,
  isEditorDraftDbBound,
  readBoundEditorDraft,
  scheduleWriteEditorDraft,
  writeEditorDraftNow,
} from '../services/EditorDraftService';

export const FORM_DRAFT_FIELD = 'form';
/** Draft key for not-yet-created entities: one pending creation per type per story. */
export const NEW_ENTITY_DRAFT_ID = 'new';

type DurableFormDraftOptions<TFields extends Record<string, unknown>> = {
  storyId?: string;
  entityType: string;
  /** Omitted while creating - the draft is keyed as the story's pending `new` entity. */
  entityId?: string;
  /** Whether the initial load finished; nothing is read or written before that. */
  enabled: boolean;
  /** Current field values; must be JSON-safe. */
  snapshot: TFields;
  /** Creation defaults or loaded database values: matching them means "nothing unsaved". */
  pristine: TFields;
  /**
   * Edit-mode stale guard: the entity's `updatedAt` ISO string as loaded. A draft saved against
   * an older `updatedAt` (edited elsewhere since) is discarded instead of restored. Omit while
   * creating.
   */
  baseUpdatedAt?: string | null;
  onRestore: (fields: TFields) => void;
};

type StoredFormDraft = {
  fields: Record<string, unknown>;
  baseUpdatedAt?: string | null;
};

function parseStoredDraft(raw: string): StoredFormDraft | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredFormDraft>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.fields ||
      typeof parsed.fields !== 'object'
    ) {
      return null;
    }
    return { fields: parsed.fields, baseUpdatedAt: parsed.baseUpdatedAt ?? null };
  } catch (error) {
    console.error('Corrupt form draft ignored:', error);
    return null;
  }
}

/**
 * Durable primary-field drafts for entity forms: typed content survives drawer switches,
 * navigation round-trips and process death, and is cleared only on successful save (or delete).
 *
 * Lifecycle per (story, entity type, entity):
 * - mount: restore the stored snapshot over the initial values, unless stale or corrupt;
 * - change: debounced write while the snapshot differs from pristine; the row is removed again
 *   when the user reverts to pristine, so "no unsaved changes" never leaves a draft behind;
 * - save/delete: the caller clears via `clearFormDraft`.
 */
export function useDurableFormDraft<TFields extends Record<string, unknown>>({
  storyId,
  entityType,
  entityId,
  enabled,
  snapshot,
  pristine,
  baseUpdatedAt,
  onRestore,
}: DurableFormDraftOptions<TFields>): {
  clearFormDraft: () => Promise<void>;
  draftRestored: boolean;
} {
  const draftEntityId = entityId ?? NEW_ENTITY_DRAFT_ID;
  const [draftRestored, setDraftRestored] = useState(false);
  const restoreAttemptedRef = useRef(false);
  // expo-sqlite completes concurrent async queries in no guaranteed order (concurrent queue on
  // iOS, shared IO pool on Android), so the track effect below must not issue anything - not
  // even the pristine-clear - until the restore read has settled. Otherwise the clear can land
  // first and destroy the draft the read was about to restore. State (not a ref) so settling
  // re-renders and unblocks tracking even when there is no row to restore.
  const [restoreSettled, setRestoreSettled] = useState(false);
  const lastWrittenRef = useRef<string | null>(null);
  // After an explicit clear (successful save/delete) this instance never writes again: every
  // caller navigates away right after, and a post-clear write would resurrect the draft.
  const clearedRef = useRef(false);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  const latestSnapshotRef = useRef(snapshot);
  latestSnapshotRef.current = snapshot;
  const latestPristineRef = useRef(pristine);
  latestPristineRef.current = pristine;
  // The unmount cleanup below is mount-only: without this ref it would keep the first render's
  // `baseUpdatedAt` (still null while the entity loads) and every flushed edit draft would look
  // stale on the way back.
  const latestBaseUpdatedAtRef = useRef(baseUpdatedAt);
  latestBaseUpdatedAtRef.current = baseUpdatedAt;

  const clearFormDraft = useCallback(async () => {
    clearedRef.current = true;
    lastWrittenRef.current = null;
    if (!storyId || !isEditorDraftDbBound()) return;
    await clearBoundEditorDraft(storyId, entityType, draftEntityId, FORM_DRAFT_FIELD);
  }, [storyId, entityType, draftEntityId]);

  useEffect(() => {
    if (!enabled || !storyId || restoreAttemptedRef.current) return;
    if (!isEditorDraftDbBound()) {
      setRestoreSettled(true);
      return;
    }
    restoreAttemptedRef.current = true;
    void (async () => {
      let row: { content: string } | null = null;
      try {
        row = await readBoundEditorDraft(storyId, entityType, draftEntityId, FORM_DRAFT_FIELD);
      } catch (error) {
        console.error('Failed to read form draft:', error);
      } finally {
        setRestoreSettled(true);
      }
      if (!row) return;
      const stored = parseStoredDraft(row.content);
      if (!stored) {
        await clearBoundEditorDraft(storyId, entityType, draftEntityId, FORM_DRAFT_FIELD);
        return;
      }
      // Another device (or this one, via sync) saved the entity after the draft: resurrecting
      // the older typing over newer data would be wrong, so the stale draft dies here.
      if (baseUpdatedAt !== undefined && stored.baseUpdatedAt !== baseUpdatedAt) {
        await clearBoundEditorDraft(storyId, entityType, draftEntityId, FORM_DRAFT_FIELD);
        return;
      }
      lastWrittenRef.current = JSON.stringify(stored.fields);
      setDraftRestored(true);
      onRestoreRef.current(stored.fields as TFields);
    })();
  }, [enabled, storyId, entityType, draftEntityId, baseUpdatedAt]);

  const serialized = JSON.stringify(snapshot);
  useEffect(() => {
    if (!enabled || !storyId || !restoreSettled || clearedRef.current || !isEditorDraftDbBound())
      return;
    if (serialized === lastWrittenRef.current) return;
    lastWrittenRef.current = serialized;
    if (serialized === JSON.stringify(pristine)) {
      void clearBoundEditorDraft(storyId, entityType, draftEntityId, FORM_DRAFT_FIELD);
      return;
    }
    scheduleWriteEditorDraft(
      storyId,
      entityType,
      draftEntityId,
      FORM_DRAFT_FIELD,
      JSON.stringify({ fields: snapshot, baseUpdatedAt: baseUpdatedAt ?? null }),
    );
    // `snapshot`/`pristine` identities change every render; the serialized strings are the
    // real dependencies. `baseUpdatedAt` is stable per mount (loaded once with the entity).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, storyId, entityType, draftEntityId, serialized, restoreSettled]);

  // Flush-on-unmount: navigation away inside the debounce window must not eat the last
  // keystrokes. `writeEditorDraftNow` cancels the pending debounced timer first, so this never
  // double-writes - it just fires the pending write early. Fire-and-forget: the SQLite write
  // outlives the unmounted component.
  useEffect(
    () => () => {
      if (!storyId || clearedRef.current || !isEditorDraftDbBound()) return;
      const latest = JSON.stringify(latestSnapshotRef.current);
      if (latest === JSON.stringify(latestPristineRef.current)) {
        void clearBoundEditorDraft(storyId, entityType, draftEntityId, FORM_DRAFT_FIELD);
        return;
      }
      void writeEditorDraftNow(
        storyId,
        entityType,
        draftEntityId,
        FORM_DRAFT_FIELD,
        JSON.stringify({
          fields: latestSnapshotRef.current,
          baseUpdatedAt: latestBaseUpdatedAtRef.current ?? null,
        }),
      ).catch((error) => {
        console.error('Failed to flush form draft on unmount:', error);
      });
    },
    // Mount-only subscription; everything mutable goes through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { clearFormDraft, draftRestored };
}
