import {
  MAX_SCENE_BODY_LENGTH,
  parseMarkdownToDocument,
  serializeDocumentToMarkdown,
} from '@keres/shared';
import { useCallback, useMemo, useState } from 'react';
import {
  applySurfaceChange,
  createManuscriptEditor,
  getEditorActiveMarks,
  getEditorCounts,
  getSurfaceText,
  setEditorSelection,
  toggleEditorHeading,
  toggleEditorMark,
  type ManuscriptEditorSelection,
  type ManuscriptEditorState,
  type ManuscriptFormatKind,
} from '../components/features/manuscript/manuscriptDocumentEngine';
import {
  getManuscriptSizeStatus,
  type ManuscriptSizeStatus,
} from '../components/features/manuscript/parseManuscriptMarkdown';
import {
  SCENE_BODY_DRAFT_FIELD,
  readBoundEditorDraft,
} from '../services/EditorDraftService';
import { useAsyncOperation } from './useAsyncOperation';
import { useDurableFormDraft } from './useDurableFormDraft';

export type SceneBodyFields = { body: string };

export type { ManuscriptSizeStatus };
export type { ManuscriptEditorSelection, ManuscriptEditorState };

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
 * Manuscript prose state for one scene: the editing document, its durable
 * client-only draft and save.
 *
 * The editor holds styled runs; drafts, persistence and comments keep flowing
 * serialized markdown, so the storage format, the 30k cap and every downstream
 * consumer (sync, export, search) are untouched. After a successful save the
 * stored row is removed with the non-terminal clear so stay-mounted hosts keep
 * drafting on the next keystroke; navigating away afterwards flushes nothing
 * because the serialized body already matches the saved one.
 */
export function useSceneBodyDraft({
  storyId,
  sceneId,
  savedBody,
  baseUpdatedAt,
  enabled,
  persist,
}: UseSceneBodyDraftOptions) {
  const [editor, setEditor] = useState<ManuscriptEditorState>(() =>
    createManuscriptEditor(parseMarkdownToDocument(savedBody ?? '')),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const serializedBody = useMemo(() => serializeDocumentToMarkdown(editor.doc), [editor]);
  // Dirtiness compares canonical forms: semantically-equal stored markdown
  // (adjacent same-mark spans, extra blank lines) mounts clean instead of
  // drafting a normalization nobody typed. Storage canonicalizes on save.
  const savedCanonicalBody = useMemo(
    () => serializeDocumentToMarkdown(parseMarkdownToDocument(savedBody ?? '')),
    [savedBody],
  );
  const surfaceText = useMemo(() => getSurfaceText(editor), [editor]);
  const { chars: charCount, words: wordCount } = useMemo(() => getEditorCounts(editor), [editor]);
  const activeMarks = useMemo(() => getEditorActiveMarks(editor), [editor]);
  const handleRestore = useCallback((fields: SceneBodyFields) => {
    setEditor(
      createManuscriptEditor(
        parseMarkdownToDocument(typeof fields.body === 'string' ? fields.body : ''),
      ),
    );
  }, []);
  const { clearFormDraft, deleteStoredDraft, draftRestored } = useDurableFormDraft<SceneBodyFields>(
    {
      storyId,
      entityType: 'Scene',
      field: SCENE_BODY_DRAFT_FIELD,
      entityId: sceneId,
      enabled,
      snapshot: { body: serializedBody },
      pristine: { body: savedCanonicalBody },
      baseUpdatedAt,
      onRestore: handleRestore,
    },
  );

  const isDirty = serializedBody !== savedCanonicalBody;
  // Counts run on markup-free content, but the storage cap the server enforces
  // is measured on the serialized source — hence the 27k/3k split.
  const overLimit = serializedBody.length > MAX_SCENE_BODY_LENGTH;

  const changeText = useCallback((text: string) => {
    setEditor((prev) => applySurfaceChange(prev, text));
  }, []);
  const changeSelection = useCallback((selection: ManuscriptEditorSelection) => {
    setEditor((prev) => setEditorSelection(prev, selection));
  }, []);
  const applyFormat = useCallback((kind: ManuscriptFormatKind) => {
    setEditor((prev) =>
      kind === 'heading' ? toggleEditorHeading(prev) : toggleEditorMark(prev, kind),
    );
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    let ok = false;
    await runSave(async () => {
      setSaveError(null);
      try {
        await persist(serializedBody === '' ? null : serializedBody);
        await deleteStoredDraft();
        ok = true;
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : String(error));
      }
    });
    return ok;
  }, [runSave, persist, serializedBody, deleteStoredDraft]);

  return {
    editor,
    surfaceText,
    serializedBody,
    changeText,
    changeSelection,
    applyFormat,
    activeMarks,
    wordCount,
    charCount,
    sizeStatus: getManuscriptSizeStatus(charCount),
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
