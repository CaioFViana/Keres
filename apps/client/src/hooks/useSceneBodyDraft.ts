import {
  MAX_SCENE_BODY_LENGTH,
  documentTextContent,
  documentToEnrichedHtml,
  enrichedHtmlToDocument,
  parseMarkdownToDocument,
  serializeDocumentToMarkdown,
  type ManuscriptDocument,
  type ManuscriptMark,
} from '@keres/shared';
import type { EnrichedTextInputInstance } from 'react-native-enriched-html';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  countManuscriptDisplayChars,
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
 * The native editor owns live content and styling (uncontrolled); this hook
 * mirrors it as a document through the HTML boundary. Drafts, persistence and
 * comments keep flowing serialized markdown, so the storage format and every
 * downstream consumer (sync, export, search) are untouched.
 *
 * Counting runs on two tracks: the footer shows plain words and visible
 * characters (markup is metadata, never characters), while the 20k length
 * warning and the hard 30k typing cap measure serialized storage — what the
 * backend actually persists. No number is ever shown for either threshold.
 *
 * After a successful save the stored row is removed with the non-terminal
 * clear so stay-mounted hosts keep drafting on the next keystroke; navigating
 * away afterwards flushes nothing because the serialized body already matches
 * the saved one.
 */
export function useSceneBodyDraft({
  storyId,
  sceneId,
  savedBody,
  baseUpdatedAt,
  enabled,
  persist,
}: UseSceneBodyDraftOptions) {
  const [doc, setDoc] = useState<ManuscriptDocument>(() =>
    parseMarkdownToDocument(savedBody ?? ''),
  );
  const [activeMarks, setActiveMarks] = useState<ManuscriptMark[]>([]);
  // A restored draft keeps the "unsaved" flag lit only until the user resolves
  // it: a successful save or an explicit reset means the server (or the saved
  // row) has seen everything, so the flag must clear even though the session
  // restore itself stays recorded in `draftRestored`.
  const [draftResolved, setDraftResolved] = useState(false);
  const editorRef = useRef<EnrichedTextInputInstance | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const serializedBody = useMemo(() => serializeDocumentToMarkdown(doc), [doc]);
  // Dirtiness compares canonical forms: semantically-equal stored markdown
  // (adjacent same-mark spans, extra blank lines) mounts clean instead of
  // drafting a normalization nobody typed. Storage canonicalizes on save.
  const savedCanonicalBody = useMemo(
    () => serializeDocumentToMarkdown(parseMarkdownToDocument(savedBody ?? '')),
    [savedBody],
  );
  // The uncontrolled input seeds from this on mount (RichBodyEditor freezes
  // it per mount: the web host rebuilds the editor when defaultValue
  // changes); deriving it from the live doc (not just the saved body) folds
  // pre-mount restores and tab-switch remounts into the seed.
  const initialHtml = useMemo(() => documentToEnrichedHtml(doc), [doc]);
  // Hard-cap bookkeeping: the last accepted native state and its storage
  // length. Growth past the backend allocation is refused by pushing the
  // last-good HTML back; restore/reset re-seed both so a stale seed can never
  // wipe newer content. Initialized from the mount content.
  const lastGoodHtmlRef = useRef(initialHtml);
  const prevStorageLengthRef = useRef(savedCanonicalBody.length);
  const { chars: charCount, words: wordCount } = useMemo(() => {
    const text = documentTextContent(doc);
    const trimmed = text.trim();
    return {
      chars: countManuscriptDisplayChars(text),
      words: trimmed === '' ? 0 : trimmed.split(/\s+/).length,
    };
  }, [doc]);
  const handleRestore = useCallback((fields: SceneBodyFields) => {
    // Hosts mount the editor only after the restore settles, so the seed
    // already carries the restored prose: no imperative push-in, and no race
    // against the host's asynchronous mount-seed application (which used to
    // land after the push and wipe both the visual and the doc on web).
    const next = parseMarkdownToDocument(typeof fields.body === 'string' ? fields.body : '');
    setDoc(next);
    lastGoodHtmlRef.current = documentToEnrichedHtml(next);
    prevStorageLengthRef.current = serializeDocumentToMarkdown(next).length;
  }, []);
  const { clearFormDraft, deleteStoredDraft, draftRestored, restoreSettled } =
    useDurableFormDraft<SceneBodyFields>(
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
  // Reachable only through over-cap legacy content (old drafts typed before
  // the input cap existed): live typing can never grow past the allocation.
  const overLimit = serializedBody.length > MAX_SCENE_BODY_LENGTH;

  const onHtmlChange = useCallback((html: string) => {
    const next = enrichedHtmlToDocument(html);
    const nextStorageLength = serializeDocumentToMarkdown(next).length;
    if (nextStorageLength > MAX_SCENE_BODY_LENGTH && nextStorageLength > prevStorageLengthRef.current) {
      // Hard storage cap: refuse growth past what the backend persists by
      // pushing the last accepted state back into the uncontrolled input, so
      // the keystroke (or paste) visibly has no effect. Shrinkage is always
      // accepted, so over-cap legacy content can still be fixed by deleting.
      editorRef.current?.setValue(lastGoodHtmlRef.current);
      return;
    }
    prevStorageLengthRef.current = nextStorageLength;
    lastGoodHtmlRef.current = html;
    setDoc(next);
  }, []);
  const onMarksChange = useCallback((marks: ManuscriptMark[]) => {
    setActiveMarks(marks);
  }, []);
  const applyFormat = useCallback((kind: ManuscriptMark) => {
    const instance = editorRef.current;
    if (!instance) return;
    if (kind === 'bold') instance.toggleBold();
    else if (kind === 'italic') instance.toggleItalic();
    else if (kind === 'underline') instance.toggleUnderline();
    else instance.toggleStrikeThrough();
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    let ok = false;
    await runSave(async () => {
      setSaveError(null);
      try {
        await persist(serializedBody === '' ? null : serializedBody);
        await deleteStoredDraft();
        setDraftResolved(true);
        ok = true;
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : String(error));
      }
    });
    return ok;
  }, [runSave, persist, serializedBody, deleteStoredDraft]);

  /**
   * Back to the saved prose, dropping the stored draft: the manuscript sibling
   * of the entity-form `resetForm`. Tracking stays armed (non-terminal clear),
   * so typing afterwards drafts again.
   *
   * Unlike the mount-time restore — which must never push into the editor
   * (see `handleRestore`) — this only runs on user action against a
   * long-mounted editor, so the imperative `setValue` is the documented path.
   * When the editor is unmounted (read/review modes) the ref is empty and the
   * next mount seeds from the reset doc via `initialHtml`.
   */
  const resetBody = useCallback(async (): Promise<void> => {
    const next = parseMarkdownToDocument(savedBody ?? '');
    setDoc(next);
    setActiveMarks([]);
    setDraftResolved(true);
    await deleteStoredDraft();
    const resetHtml = documentToEnrichedHtml(next);
    lastGoodHtmlRef.current = resetHtml;
    prevStorageLengthRef.current = serializeDocumentToMarkdown(next).length;
    editorRef.current?.setValue(resetHtml);
  }, [savedBody, deleteStoredDraft]);

  return {
    editorRef,
    initialHtml,
    onHtmlChange,
    onMarksChange,
    applyFormat,
    activeMarks,
    serializedBody,
    wordCount,
    charCount,
    sizeStatus: getManuscriptSizeStatus(serializedBody.length),
    isDirty,
    overLimit,
    canSave: isDirty && !overLimit && !saving,
    save,
    saving,
    saveError,
    resetBody,
    /** Dirty, or restored-from-draft and not yet saved-or-reset since. */
    hasUnsavedChanges: isDirty || (draftRestored && !draftResolved),
    /** Terminal clear for hosts that unmount right after (mirrors the form flow). */
    clearBodyDraft: clearFormDraft,
    draftRestored,
    /** True once the stored draft (if any) has been restored: mount the editor only then. */
    restoreSettled,
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
