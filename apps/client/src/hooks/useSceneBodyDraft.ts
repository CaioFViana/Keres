import { MAX_SCENE_BODY_LENGTH } from '@keres/shared';
import { useCallback, useState } from 'react';
import {
  SCENE_BODY_DRAFT_FIELD,
  readBoundEditorDraft,
} from '../services/EditorDraftService';
import { useAsyncOperation } from './useAsyncOperation';
import { useDurableFormDraft } from './useDurableFormDraft';

export type SceneBodyFields = { body: string };

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

type UseSceneBodyDraftOptions = {
  storyId?: string;
  sceneId: string;
  /** The persisted body. Must be known before mounting - text never resets from it later. */
  savedBody: string | null;
  /** The scene's `updatedAt` ISO string as loaded; guards against stale restores. */
  baseUpdatedAt?: string | null;
  /** Whether the scene finished loading; nothing is read or written before that. */
  enabled: boolean;
  /** Persists the body (typically `updateScene(userId, sceneId, { body })`). */
  persist: (body: string | null) => Promise<void>;
};

/**
 * Manuscript prose state for one scene: the text, its durable client-only draft and save.
 *
 * The draft reuses `useDurableFormDraft` as a single-field snapshot, inheriting restore,
 * stale-guard, debounce and flush-on-unmount. After a successful save the stored row is
 * removed with the non-terminal clear so stay-mounted hosts (the manuscript's inline
 * section) keep drafting on the next keystroke; navigating away afterwards flushes
 * nothing because the text already matches the saved body.
 */
export function useSceneBodyDraft({
  storyId,
  sceneId,
  savedBody,
  baseUpdatedAt,
  enabled,
  persist,
}: UseSceneBodyDraftOptions) {
  const [text, setText] = useState(savedBody ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const handleRestore = useCallback((fields: SceneBodyFields) => {
    setText(typeof fields.body === 'string' ? fields.body : '');
  }, []);
  const { clearFormDraft, deleteStoredDraft, draftRestored } = useDurableFormDraft<SceneBodyFields>(
    {
      storyId,
      entityType: 'Scene',
      field: SCENE_BODY_DRAFT_FIELD,
      entityId: sceneId,
      enabled,
      snapshot: { body: text },
      pristine: { body: savedBody ?? '' },
      baseUpdatedAt,
      onRestore: handleRestore,
    },
  );

  const isDirty = text !== (savedBody ?? '');
  const overLimit = text.length > MAX_SCENE_BODY_LENGTH;

  const save = useCallback(async (): Promise<boolean> => {
    let ok = false;
    await runSave(async () => {
      setSaveError(null);
      try {
        await persist(text === '' ? null : text);
        await deleteStoredDraft();
        ok = true;
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : String(error));
      }
    });
    return ok;
  }, [runSave, persist, text, deleteStoredDraft]);

  return {
    text,
    setText,
    wordCount: countWords(text),
    charCount: text.length,
    maxLength: MAX_SCENE_BODY_LENGTH,
    isDirty,
    overLimit,
    canSave: isDirty && !overLimit && !saving,
    save,
    saving,
    saveError,
    /** Terminal clear for hosts that unmount right after (mirrors the form flow). */
    clearBodyDraft: clearFormDraft,
    draftRestored,
  };
}

type StoredBodyDraft = { fields?: { body?: unknown } };

/**
 * Reads just the prose of a stored scene draft, for hosts that only need an indicator
 * (e.g. the scene detail card showing "unsaved draft"). Corrupt or missing rows read as null.
 */
export async function readStoredSceneBodyText(
  storyId: string,
  sceneId: string,
): Promise<string | null> {
  const row = await readBoundEditorDraft(storyId, 'Scene', sceneId, SCENE_BODY_DRAFT_FIELD);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.content) as StoredBodyDraft;
    return typeof parsed?.fields?.body === 'string' ? parsed.fields.body : null;
  } catch {
    return null;
  }
}
