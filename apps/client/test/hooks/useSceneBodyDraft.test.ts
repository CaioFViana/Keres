/** @jest-environment node */
import { MAX_SCENE_BODY_LENGTH } from '@keres/shared';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { EnrichedTextInputInstance } from 'react-native-enriched-html';
import {
  readStoredSceneBodyText,
  useSceneBodyDraft,
} from '../../src/hooks/useSceneBodyDraft';
import * as EditorDraftService from '../../src/services/EditorDraftService';
import {
  SCENE_BODY_DRAFT_FIELD,
  readEditorDraft,
  resetEditorDraftDbForTests,
  setEditorDraftDb,
  writeEditorDraft,
} from '../../src/services/EditorDraftService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

async function storedBodyRow() {
  return readEditorDraft(database.db, 'story-1', 'Scene', 'scene-1', SCENE_BODY_DRAFT_FIELD);
}

async function seedBodyDraft(body: string, baseUpdatedAt: string | null = null) {
  await writeEditorDraft(
    database.db,
    'story-1',
    'Scene',
    'scene-1',
    SCENE_BODY_DRAFT_FIELD,
    JSON.stringify({ fields: { body }, baseUpdatedAt }),
  );
}

function useHarness(options: {
  savedBody?: string | null;
  baseUpdatedAt?: string | null;
  enabled?: boolean;
  persist?: (body: string | null) => Promise<void>;
}) {
  return useSceneBodyDraft({
    storyId: 'story-1',
    sceneId: 'scene-1',
    savedBody: options.savedBody ?? null,
    baseUpdatedAt: options.baseUpdatedAt,
    enabled: options.enabled ?? true,
    persist: options.persist ?? (async () => {}),
  });
}

function html(body: string): string {
  return `<html>${body}</html>`;
}

function fakeInstance() {
  return {
    toggleBold: jest.fn(),
    toggleItalic: jest.fn(),
    toggleUnderline: jest.fn(),
    toggleStrikeThrough: jest.fn(),
    setValue: jest.fn(),
    focus: jest.fn(),
  };
}

beforeEach(async () => {
  database = await createTestDatabase();
  setEditorDraftDb(database.db);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  resetEditorDraftDbForTests();
  database.close();
  jest.restoreAllMocks();
});

describe('useSceneBodyDraft', () => {
  it('starts from the saved body, clean and unsavable', async () => {
    const view = await renderHook(() => useHarness({ savedBody: 'Once upon a time' }));

    expect(view.result.current.initialHtml).toBe(html('<p>Once upon a time</p>'));
    expect(view.result.current.serializedBody).toBe('Once upon a time');
    expect(view.result.current.wordCount).toBe(4);
    expect(view.result.current.charCount).toBe(16);
    expect(view.result.current.isDirty).toBe(false);
    expect(view.result.current.canSave).toBe(false);
    expect(view.result.current.overLimit).toBe(false);
  });

  it('starts empty when nothing was ever written', async () => {
    const view = await renderHook(() => useHarness({ savedBody: null }));

    expect(view.result.current.initialHtml).toBe('');
    expect(view.result.current.serializedBody).toBe('');
    expect(view.result.current.wordCount).toBe(0);
  });

  it('restores a stored prose draft over the saved body', async () => {
    await seedBodyDraft('unsaved prose');
    const view = await renderHook(() => useHarness({ savedBody: 'saved' }));

    await waitFor(() => expect(view.result.current.draftRestored).toBe(true));
    expect(view.result.current.serializedBody).toBe('unsaved prose');
    expect(view.result.current.initialHtml).toBe(html('<p>unsaved prose</p>'));
    expect(view.result.current.isDirty).toBe(true);
  });

  it('seeds restores without touching a mounted editor', async () => {
    type DraftRow = Awaited<ReturnType<typeof EditorDraftService.readBoundEditorDraft>>;
    let resolveRead!: (row: DraftRow) => void;
    const gate = new Promise<DraftRow>((resolve) => {
      resolveRead = resolve;
    });
    jest.spyOn(EditorDraftService, 'readBoundEditorDraft').mockImplementation(() => gate);
    const view = await renderHook(() => useHarness({ savedBody: 'saved' }));
    expect(view.result.current.restoreSettled).toBe(false);
    const instance = fakeInstance();
    view.result.current.editorRef.current = instance as unknown as EnrichedTextInputInstance;

    await act(async () => {
      resolveRead({
        content: JSON.stringify({ fields: { body: 'unsaved prose' }, baseUpdatedAt: null }),
      } as DraftRow);
      await gate;
    });
    await waitFor(() => expect(view.result.current.draftRestored).toBe(true));

    // Hosts mount the editor only after the settle, so the seed already
    // carries the restore: pushing it in would race the host's asynchronous
    // mount-seed application, which lands last on web and wipes the restore.
    expect(view.result.current.restoreSettled).toBe(true);
    expect(instance.setValue).not.toHaveBeenCalled();
    expect(view.result.current.initialHtml).toBe(html('<p>unsaved prose</p>'));
    expect(view.result.current.serializedBody).toBe('unsaved prose');
  });

  it('settles vacuously when disabled without reading', async () => {
    const read = jest.spyOn(EditorDraftService, 'readBoundEditorDraft');
    const view = await renderHook(() => useHarness({ savedBody: 'saved', enabled: false }));

    expect(view.result.current.restoreSettled).toBe(true);
    expect(view.result.current.draftRestored).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it('discards a draft saved against an older revision', async () => {
    await seedBodyDraft('stale prose', '2026-01-01T00:00:00.000Z');
    const view = await renderHook(() =>
      useHarness({ savedBody: 'newer', baseUpdatedAt: '2026-02-01T00:00:00.000Z' }),
    );

    await waitFor(async () => expect(await storedBodyRow()).toBeNull());
    expect(view.result.current.draftRestored).toBe(false);
    expect(view.result.current.serializedBody).toBe('newer');
  });

  it('drafts typing under the body field, debounced', async () => {
    jest.useFakeTimers();
    const view = await renderHook(() => useHarness({ savedBody: 'saved' }));

    await act(async () => {
      view.result.current.onHtmlChange(html('<p>saved plus more</p>'));
    });
    expect(view.result.current.isDirty).toBe(true);
    expect(view.result.current.canSave).toBe(true);
    expect(await storedBodyRow()).toBeNull();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    const row = await storedBodyRow();
    expect(row).not.toBeNull();
    expect(JSON.parse(row!.content)).toMatchObject({ fields: { body: 'saved plus more' } });
    jest.useRealTimers();
  });

  it('saves through persist and clears the draft, reporting success', async () => {
    jest.useFakeTimers();
    const persist = jest.fn(async () => {});
    const view = await renderHook(() => useHarness({ savedBody: 'saved', persist }));

    await act(async () => {
      view.result.current.onHtmlChange(html('<p>saved plus more</p>'));
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    expect(await storedBodyRow()).not.toBeNull();

    let ok = false;
    await act(async () => {
      ok = await view.result.current.save();
    });
    expect(ok).toBe(true);
    expect(persist).toHaveBeenCalledWith('saved plus more');
    expect(await storedBodyRow()).toBeNull();
    expect(view.result.current.saving).toBe(false);
    expect(view.result.current.saveError).toBeNull();
    jest.useRealTimers();
  });

  it('persists null when the text was cleared', async () => {
    const persist = jest.fn(async () => {});
    const view = await renderHook(() => useHarness({ savedBody: 'saved', persist }));

    await act(async () => {
      view.result.current.onHtmlChange('');
    });
    await act(async () => {
      await view.result.current.save();
    });

    expect(persist).toHaveBeenCalledWith(null);
  });

  it('keeps the draft and reports the error when persist fails', async () => {
    jest.useFakeTimers();
    const persist = jest.fn(async () => {
      throw new Error('sync blew up');
    });
    const view = await renderHook(() => useHarness({ savedBody: 'saved', persist }));

    await act(async () => {
      view.result.current.onHtmlChange(html('<p>doomed</p>'));
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    let ok = true;
    await act(async () => {
      ok = await view.result.current.save();
    });

    expect(ok).toBe(false);
    expect(view.result.current.saveError).toBe('sync blew up');
    expect(await storedBodyRow()).not.toBeNull();
    jest.useRealTimers();
  });

  it('refuses typing past the storage cap, pushing back the last accepted state', async () => {
    const view = await renderHook(() => useHarness({ savedBody: '' }));
    const instance = fakeInstance();
    view.result.current.editorRef.current = instance as unknown as EnrichedTextInputInstance;

    const atCap = html(`<p>${'x'.repeat(MAX_SCENE_BODY_LENGTH)}</p>`);
    await act(async () => {
      view.result.current.onHtmlChange(atCap);
    });
    expect(view.result.current.serializedBody).toBe('x'.repeat(MAX_SCENE_BODY_LENGTH));
    expect(view.result.current.overLimit).toBe(false);
    expect(view.result.current.canSave).toBe(true);

    await act(async () => {
      view.result.current.onHtmlChange(html(`<p>${'x'.repeat(MAX_SCENE_BODY_LENGTH + 1)}</p>`));
    });
    expect(view.result.current.serializedBody).toBe('x'.repeat(MAX_SCENE_BODY_LENGTH));
    expect(view.result.current.overLimit).toBe(false);
    expect(instance.setValue).toHaveBeenCalledWith(atCap);
  });

  it('accepts deletions from over-cap legacy content but refuses further growth', async () => {
    const view = await renderHook(() =>
      useHarness({ savedBody: 'x'.repeat(MAX_SCENE_BODY_LENGTH + 5) }),
    );
    const instance = fakeInstance();
    view.result.current.editorRef.current = instance as unknown as EnrichedTextInputInstance;

    expect(view.result.current.overLimit).toBe(true);
    expect(view.result.current.canSave).toBe(false);

    await act(async () => {
      view.result.current.onHtmlChange(html(`<p>${'x'.repeat(MAX_SCENE_BODY_LENGTH + 6)}</p>`));
    });
    expect(view.result.current.serializedBody).toBe('x'.repeat(MAX_SCENE_BODY_LENGTH + 5));
    expect(instance.setValue).toHaveBeenCalledTimes(1);

    await act(async () => {
      view.result.current.onHtmlChange(html(`<p>${'x'.repeat(MAX_SCENE_BODY_LENGTH)}</p>`));
    });
    expect(view.result.current.serializedBody).toBe('x'.repeat(MAX_SCENE_BODY_LENGTH));
    expect(view.result.current.overLimit).toBe(false);
    expect(view.result.current.canSave).toBe(true);
  });

  it('loads stored markdown as content with zero markup in the counts', async () => {
    const view = await renderHook(() =>
      useHarness({ savedBody: '# Title\n\nA **bold** move.' }),
    );

    expect(view.result.current.initialHtml).toBe(
      html('<p>Title</p><p>A <b>bold</b> move.</p>'),
    );
    // The paragraph break counts once, the way Word counts paragraph marks.
    expect(view.result.current.charCount).toBe('Title\nA bold move.'.length);
    expect(view.result.current.wordCount).toBe(4);
    expect(view.result.current.sizeStatus).toBe('ok');
    // Legacy `# ` prefixes degrade to plain paragraphs, content preserved.
    expect(view.result.current.serializedBody).toBe('Title\n\nA **bold** move.');
    expect(view.result.current.isDirty).toBe(false);
  });

  it('treats typed markup characters as content, escaping them on serialize', async () => {
    const view = await renderHook(() => useHarness({ savedBody: '' }));

    await act(async () => {
      view.result.current.onHtmlChange(html('<p>a*b*c</p>'));
    });

    expect(view.result.current.charCount).toBe(5);
    expect(view.result.current.serializedBody).toBe('a\\*b\\*c');
  });

  it('reports the size band on storage chars, warning early on markup-heavy prose', async () => {
    const view = await renderHook(() => useHarness({ savedBody: '' }));

    await act(async () => {
      view.result.current.onHtmlChange(html(`<p>${'x'.repeat(19999)}</p>`));
    });
    expect(view.result.current.charCount).toBe(19999);
    expect(view.result.current.sizeStatus).toBe('ok');

    await act(async () => {
      view.result.current.onHtmlChange(html(`<p>${'x'.repeat(20000)}</p>`));
    });
    expect(view.result.current.sizeStatus).toBe('large');

    // Markup counts toward storage but never toward the displayed count: the
    // warning fires while the reader-visible text is still short.
    await act(async () => {
      view.result.current.onHtmlChange(html(`<p><b>${'x'.repeat(19997)}</b></p>`));
    });
    expect(view.result.current.charCount).toBe(19997);
    expect(view.result.current.serializedBody).toBe(`**${'x'.repeat(19997)}**`);
    expect(view.result.current.sizeStatus).toBe('large');

    // Advisory only: everything under the storage cap still saves.
    await act(async () => {
      view.result.current.onHtmlChange(html(`<p>${'x'.repeat(27000)}</p>`));
    });
    expect(view.result.current.sizeStatus).toBe('large');
    expect(view.result.current.overLimit).toBe(false);
    expect(view.result.current.canSave).toBe(true);
  });

  it('warns on storage while the displayed count stays small', async () => {
    const view = await renderHook(() => useHarness({ savedBody: '**a**b'.repeat(3500) }));

    expect(view.result.current.charCount).toBe(7000);
    expect(view.result.current.serializedBody.length).toBe(21000);
    expect(view.result.current.sizeStatus).toBe('large');
  });

  it('still enforces the storage cap on the serialized source', async () => {
    const persist = jest.fn(async () => {});
    // 12000 content chars, but over 30k stored: alternating marks never merge.
    const view = await renderHook(() =>
      useHarness({ savedBody: '**a**b'.repeat(6000), persist }),
    );

    expect(view.result.current.charCount).toBe(12000);
    expect(view.result.current.sizeStatus).toBe('large');
    expect(view.result.current.overLimit).toBe(true);
    expect(view.result.current.canSave).toBe(false);
    expect(view.result.current.isDirty).toBe(false);
  });

  it('mounts semantically-equal markdown clean and canonicalizes on save', async () => {
    const persist = jest.fn(async () => {});
    const view = await renderHook(() => useHarness({ savedBody: '**a****b**', persist }));

    expect(view.result.current.serializedBody).toBe('**ab**');
    expect(view.result.current.isDirty).toBe(false);

    await act(async () => {
      view.result.current.onHtmlChange(html('<p><b>abc</b></p>'));
    });
    await act(async () => {
      await view.result.current.save();
    });

    expect(persist).toHaveBeenCalledWith('**abc**');
  });

  it('drives toolbar toggles through the editor instance', async () => {
    const view = await renderHook(() => useHarness({ savedBody: 'hello' }));
    const instance = fakeInstance();
    view.result.current.editorRef.current = instance as unknown as EnrichedTextInputInstance;

    await act(async () => {
      view.result.current.applyFormat('bold');
      view.result.current.applyFormat('italic');
      view.result.current.applyFormat('underline');
      view.result.current.applyFormat('strikethrough');
    });

    expect(instance.toggleBold).toHaveBeenCalledTimes(1);
    expect(instance.toggleItalic).toHaveBeenCalledTimes(1);
    expect(instance.toggleUnderline).toHaveBeenCalledTimes(1);
    expect(instance.toggleStrikeThrough).toHaveBeenCalledTimes(1);
  });

  it('ignores toolbar actions before the editor mounts', async () => {
    const view = await renderHook(() => useHarness({ savedBody: 'hello' }));

    await act(async () => {
      view.result.current.applyFormat('bold');
    });

    expect(view.result.current.serializedBody).toBe('hello');
  });

  it('reports native active marks to the toolbar', async () => {
    const view = await renderHook(() => useHarness({ savedBody: 'hello' }));

    expect(view.result.current.activeMarks).toEqual([]);

    await act(async () => {
      view.result.current.onMarksChange(['bold', 'italic']);
    });

    expect(view.result.current.activeMarks).toEqual(['bold', 'italic']);
  });

  it('resets typed prose back to the saved body, pushing it into the mounted editor', async () => {
    jest.useFakeTimers();
    const view = await renderHook(() => useHarness({ savedBody: 'saved' }));
    const instance = fakeInstance();
    view.result.current.editorRef.current = instance as unknown as EnrichedTextInputInstance;

    await act(async () => {
      view.result.current.onHtmlChange(html('<p>saved plus more</p>'));
      view.result.current.onMarksChange(['bold']);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    expect(await storedBodyRow()).not.toBeNull();

    await act(async () => {
      await view.result.current.resetBody();
    });

    expect(view.result.current.serializedBody).toBe('saved');
    expect(view.result.current.initialHtml).toBe(html('<p>saved</p>'));
    expect(view.result.current.isDirty).toBe(false);
    expect(view.result.current.activeMarks).toEqual([]);
    expect(view.result.current.hasUnsavedChanges).toBe(false);
    expect(await storedBodyRow()).toBeNull();
    expect(instance.setValue).toHaveBeenCalledWith(html('<p>saved</p>'));
    jest.useRealTimers();
  });

  it('resets through the seed when the editor is unmounted', async () => {
    const view = await renderHook(() => useHarness({ savedBody: 'saved' }));

    await act(async () => {
      view.result.current.onHtmlChange(html('<p>typed</p>'));
    });
    expect(view.result.current.isDirty).toBe(true);

    // No mounted instance (read/review modes unmount the input): the reset
    // must not throw, and the next mount seeds from the reset doc.
    await act(async () => {
      await view.result.current.resetBody();
    });

    expect(view.result.current.serializedBody).toBe('saved');
    expect(view.result.current.initialHtml).toBe(html('<p>saved</p>'));
    expect(view.result.current.isDirty).toBe(false);
  });

  it('keeps drafting after a reset while staying mounted', async () => {
    jest.useFakeTimers();
    const view = await renderHook(() => useHarness({ savedBody: 'saved' }));

    await act(async () => {
      view.result.current.onHtmlChange(html('<p>v2</p>'));
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    expect(await storedBodyRow()).not.toBeNull();

    await act(async () => {
      await view.result.current.resetBody();
    });
    expect(await storedBodyRow()).toBeNull();

    await act(async () => {
      view.result.current.onHtmlChange(html('<p>v3</p>'));
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    const row = await storedBodyRow();
    expect(row).not.toBeNull();
    expect(JSON.parse(row!.content)).toMatchObject({ fields: { body: 'v3' } });
    jest.useRealTimers();
  });

  it('clears the restored flag when reset back to the saved body', async () => {
    await seedBodyDraft('unsaved prose');
    const view = await renderHook(() => useHarness({ savedBody: 'saved' }));

    await waitFor(() => expect(view.result.current.draftRestored).toBe(true));
    expect(view.result.current.hasUnsavedChanges).toBe(true);

    await act(async () => {
      await view.result.current.resetBody();
    });

    expect(view.result.current.serializedBody).toBe('saved');
    expect(view.result.current.hasUnsavedChanges).toBe(false);
    expect(await storedBodyRow()).toBeNull();
  });

  it('clears a restored-but-clean draft from the unsaved flag on save', async () => {
    await seedBodyDraft('saved');
    const persist = jest.fn(async () => {});
    const view = await renderHook(() => useHarness({ savedBody: 'saved', persist }));

    await waitFor(() => expect(view.result.current.draftRestored).toBe(true));
    expect(view.result.current.isDirty).toBe(false);
    expect(view.result.current.hasUnsavedChanges).toBe(true);

    await act(async () => {
      await view.result.current.save();
    });

    expect(persist).toHaveBeenCalledWith('saved');
    expect(view.result.current.hasUnsavedChanges).toBe(false);
  });

  it('keeps drafting after a save while staying mounted', async () => {
    jest.useFakeTimers();
    const view = await renderHook(() => useHarness({ savedBody: 'saved' }));

    await act(async () => {
      view.result.current.onHtmlChange(html('<p>v2</p>'));
    });
    await act(async () => {
      await view.result.current.save();
    });
    expect(await storedBodyRow()).toBeNull();

    await act(async () => {
      view.result.current.onHtmlChange(html('<p>v3</p>'));
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    const row = await storedBodyRow();
    expect(row).not.toBeNull();
    expect(JSON.parse(row!.content)).toMatchObject({ fields: { body: 'v3' } });
    jest.useRealTimers();
  });
});

describe('readStoredSceneBodyText', () => {
  it('returns the stored prose', async () => {
    await seedBodyDraft('half a chapter');
    await expect(readStoredSceneBodyText('story-1', 'scene-1')).resolves.toBe('half a chapter');
  });

  it('returns null when nothing is stored', async () => {
    await expect(readStoredSceneBodyText('story-1', 'scene-1')).resolves.toBeNull();
  });

  it('returns null for corrupt rows instead of throwing', async () => {
    await writeEditorDraft(
      database.db,
      'story-1',
      'Scene',
      'scene-1',
      SCENE_BODY_DRAFT_FIELD,
      'not-json{{{',
    );
    await expect(readStoredSceneBodyText('story-1', 'scene-1')).resolves.toBeNull();
  });

  it('returns null when the envelope holds no body string', async () => {
    await writeEditorDraft(
      database.db,
      'story-1',
      'Scene',
      'scene-1',
      SCENE_BODY_DRAFT_FIELD,
      JSON.stringify({ fields: { body: 42 } }),
    );
    await expect(readStoredSceneBodyText('story-1', 'scene-1')).resolves.toBeNull();
  });
});
