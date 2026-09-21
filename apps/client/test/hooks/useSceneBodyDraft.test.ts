/** @jest-environment node */
import { MAX_SCENE_BODY_LENGTH } from '@keres/shared';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  readStoredSceneBodyText,
  useSceneBodyDraft,
} from '../../src/hooks/useSceneBodyDraft';
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

    expect(view.result.current.surfaceText).toBe('Once upon a time');
    expect(view.result.current.serializedBody).toBe('Once upon a time');
    expect(view.result.current.wordCount).toBe(4);
    expect(view.result.current.charCount).toBe(16);
    expect(view.result.current.isDirty).toBe(false);
    expect(view.result.current.canSave).toBe(false);
    expect(view.result.current.overLimit).toBe(false);
  });

  it('starts empty when nothing was ever written', async () => {
    const view = await renderHook(() => useHarness({ savedBody: null }));

    expect(view.result.current.surfaceText).toBe('');
    expect(view.result.current.serializedBody).toBe('');
    expect(view.result.current.wordCount).toBe(0);
  });

  it('restores a stored prose draft over the saved body', async () => {
    await seedBodyDraft('unsaved prose');
    const view = await renderHook(() => useHarness({ savedBody: 'saved' }));

    await waitFor(() => expect(view.result.current.draftRestored).toBe(true));
    expect(view.result.current.surfaceText).toBe('unsaved prose');
    expect(view.result.current.isDirty).toBe(true);
  });

  it('discards a draft saved against an older revision', async () => {
    await seedBodyDraft('stale prose', '2026-01-01T00:00:00.000Z');
    const view = await renderHook(() =>
      useHarness({ savedBody: 'newer', baseUpdatedAt: '2026-02-01T00:00:00.000Z' }),
    );

    await waitFor(async () => expect(await storedBodyRow()).toBeNull());
    expect(view.result.current.draftRestored).toBe(false);
    expect(view.result.current.surfaceText).toBe('newer');
  });

  it('drafts typing under the body field, debounced', async () => {
    jest.useFakeTimers();
    const view = await renderHook(() => useHarness({ savedBody: 'saved' }));

    await act(async () => {
      view.result.current.changeText('saved plus more');
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
      view.result.current.changeText('saved plus more');
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
      view.result.current.changeText('');
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
      view.result.current.changeText('doomed');
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

  it('refuses to save past the shared length cap', async () => {
    const persist = jest.fn(async () => {});
    const view = await renderHook(() => useHarness({ savedBody: '', persist }));

    await act(async () => {
      view.result.current.changeText('x'.repeat(MAX_SCENE_BODY_LENGTH + 1));
    });

    expect(view.result.current.overLimit).toBe(true);
    expect(view.result.current.canSave).toBe(false);
    expect(view.result.current.maxLength).toBe(MAX_SCENE_BODY_LENGTH);
  });

  it('loads stored markdown as content with zero markup on the surface', async () => {
    const view = await renderHook(() =>
      useHarness({ savedBody: '# Title\n\nA **bold** move.' }),
    );

    expect(view.result.current.surfaceText).toBe('Title\n\nA bold move.');
    expect(view.result.current.charCount).toBe('Title\n\nA bold move.'.length);
    expect(view.result.current.wordCount).toBe(4);
    expect(view.result.current.sizeStatus).toBe('ok');
    expect(view.result.current.serializedBody).toBe('# Title\n\nA **bold** move.');
    expect(view.result.current.isDirty).toBe(false);
  });

  it('treats typed markup characters as content, escaping them on serialize', async () => {
    const view = await renderHook(() => useHarness({ savedBody: '' }));

    await act(async () => {
      view.result.current.changeText('a*b*c');
    });

    expect(view.result.current.surfaceText).toBe('a*b*c');
    expect(view.result.current.charCount).toBe(5);
    expect(view.result.current.serializedBody).toBe('a\\*b\\*c');
  });

  it('reports the size band on content chars, ignoring stored markers', async () => {
    const view = await renderHook(() => useHarness({ savedBody: '' }));

    await act(async () => {
      view.result.current.changeText('x'.repeat(20000));
    });
    expect(view.result.current.sizeStatus).toBe('ok');

    await act(async () => {
      view.result.current.changeSelection({ start: 0, end: 20000 });
      view.result.current.applyFormat('bold');
    });
    expect(view.result.current.charCount).toBe(20000);
    expect(view.result.current.sizeStatus).toBe('ok');
    expect(view.result.current.serializedBody).toBe(`**${'x'.repeat(20000)}**`);

    await act(async () => {
      view.result.current.changeText('x'.repeat(20001));
    });
    expect(view.result.current.sizeStatus).toBe('large');

    // Advisory only: 27k warns but still saves, the storage cap is what blocks.
    await act(async () => {
      view.result.current.changeText('x'.repeat(27000));
    });
    expect(view.result.current.sizeStatus).toBe('tooLarge');
    expect(view.result.current.overLimit).toBe(false);
    expect(view.result.current.canSave).toBe(true);
  });

  it('still enforces the storage cap on the serialized source', async () => {
    const persist = jest.fn(async () => {});
    // 12000 content chars, but over 30k stored: alternating marks never merge.
    const view = await renderHook(() =>
      useHarness({ savedBody: '**a**b'.repeat(6000), persist }),
    );

    expect(view.result.current.charCount).toBe(12000);
    expect(view.result.current.sizeStatus).toBe('ok');
    expect(view.result.current.overLimit).toBe(true);
    expect(view.result.current.canSave).toBe(false);
    expect(view.result.current.isDirty).toBe(false);
  });

  it('mounts semantically-equal markdown clean and canonicalizes on save', async () => {
    const persist = jest.fn(async () => {});
    const view = await renderHook(() => useHarness({ savedBody: '**a****b**', persist }));

    expect(view.result.current.surfaceText).toBe('ab');
    expect(view.result.current.serializedBody).toBe('**ab**');
    expect(view.result.current.isDirty).toBe(false);

    await act(async () => {
      view.result.current.changeText('abc');
    });
    await act(async () => {
      await view.result.current.save();
    });

    expect(persist).toHaveBeenCalledWith('**abc**');
  });

  it('formats through the toolbar action and reports actives', async () => {
    const view = await renderHook(() => useHarness({ savedBody: 'hello' }));

    await act(async () => {
      view.result.current.changeSelection({ start: 1, end: 4 });
      view.result.current.applyFormat('bold');
    });
    expect(view.result.current.serializedBody).toBe('h**ell**o');
    expect(view.result.current.activeMarks).toEqual({ marks: ['bold'], heading: 0 });

    await act(async () => {
      view.result.current.changeSelection({ start: 2, end: 2 });
    });
    expect(view.result.current.activeMarks).toEqual({ marks: ['bold'], heading: 0 });

    await act(async () => {
      view.result.current.applyFormat('heading');
    });
    expect(view.result.current.serializedBody).toBe('# h**ell**o');
    expect(view.result.current.activeMarks.heading).toBe(1);
  });

  it('keeps drafting after a save while staying mounted', async () => {
    jest.useFakeTimers();
    const view = await renderHook(() => useHarness({ savedBody: 'saved' }));

    await act(async () => {
      view.result.current.changeText('v2');
    });
    await act(async () => {
      await view.result.current.save();
    });
    expect(await storedBodyRow()).toBeNull();

    await act(async () => {
      view.result.current.changeText('v3');
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
