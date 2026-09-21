import { parseMarkdownToDocument, serializeDocumentToMarkdown } from '@keres/shared';
import {
  applySurfaceChange,
  createManuscriptEditor,
  getEditorActiveMarks,
  getEditorCounts,
  getSurfaceText,
  setEditorSelection,
  toggleEditorHeading,
  toggleEditorMark,
} from '../../../src/components/features/manuscript/manuscriptDocumentEngine';
import type { ManuscriptEditorState } from '../../../src/components/features/manuscript/manuscriptDocumentEngine';

function editorOf(markdown: string, selection = { start: 0, end: 0 }): ManuscriptEditorState {
  return createManuscriptEditor(parseMarkdownToDocument(markdown), selection);
}

function stored(state: ManuscriptEditorState): string {
  return serializeDocumentToMarkdown(state.doc);
}

describe('createManuscriptEditor', () => {
  it('clamps and orders the selection', () => {
    expect(editorOf('', { start: 5, end: 9 }).selection).toEqual({ start: 0, end: 0 });
    expect(editorOf('hello', { start: 4, end: 1 }).selection).toEqual({ start: 1, end: 4 });
  });
});

describe('surface and counts', () => {
  it('exposes content text with zero markup', () => {
    const state = editorOf('# Title\n\nA **bold** move.');

    expect(getSurfaceText(state)).toBe('Title\n\nA bold move.');
    expect(getEditorCounts(state)).toEqual({ chars: 19, words: 4 });
  });

  it('counts whitespace-only surfaces as zero words', () => {
    const state = createManuscriptEditor({
      blocks: [{ kind: 'paragraph', spans: [{ text: '   ', marks: [] }] }],
    });

    expect(getEditorCounts(state)).toEqual({ chars: 3, words: 0 });
  });
});

describe('applySurfaceChange', () => {
  it('returns the same state when nothing changed', () => {
    const state = editorOf('hello');

    expect(applySurfaceChange(state, 'hello')).toBe(state);
  });

  it('types, deletes and replaces with the caret after the edit', () => {
    expect(applySurfaceChange(editorOf('ac'), 'abc').selection).toEqual({ start: 2, end: 2 });
    const deleted = applySurfaceChange(editorOf('abc'), 'ac');
    expect(getSurfaceText(deleted)).toBe('ac');
    expect(deleted.selection).toEqual({ start: 1, end: 1 });
    const replaced = applySurfaceChange(editorOf('hello world'), 'hello brave new world');
    expect(replaced.selection).toEqual({ start: 16, end: 16 });
  });

  it('inherits marks from the preceding char, else the following one', () => {
    expect(stored(applySurfaceChange(editorOf('**ab**'), 'abc'))).toBe('**abc**');
    expect(stored(applySurfaceChange(editorOf('**ab**'), 'xab'))).toBe('**xab**');
  });

  it('types from an empty document', () => {
    const state = applySurfaceChange(editorOf(''), 'x');

    expect(getSurfaceText(state)).toBe('x');
    expect(state.selection).toEqual({ start: 1, end: 1 });
  });

  it('keeps newlines unmarked but inherits across them like Word', () => {
    const entered = applySurfaceChange(editorOf('**ab**'), 'ab\n');

    expect(getSurfaceText(entered)).toBe('ab\n');
    expect(stored(applySurfaceChange(entered, 'ab\nc'))).toBe('**ab**\n**c**');
  });

  it('consumes pending marks for the inserted text, then clears them', () => {
    const armed = toggleEditorMark(editorOf('ab', { start: 2, end: 2 }), 'bold');
    const typed = applySurfaceChange(armed, 'abc');

    expect(stored(typed)).toBe('ab**c**');
    expect(typed.pendingMarks).toBeNull();
  });

  it('splits a block on a typed blank line, second block starts plain', () => {
    const state = applySurfaceChange(editorOf('# ab', { start: 1, end: 1 }), 'a\n\nb');

    expect(stored(state)).toBe('# a\n\nb');
    expect(state.selection).toEqual({ start: 3, end: 3 });
  });

  it('joins blocks on separator delete, preserving each side marks', () => {
    expect(stored(applySurfaceChange(editorOf('**a**\n\n*b*'), 'ab'))).toBe('**a***b*');
  });

  it('keeps the first kind when joining blocks', () => {
    expect(stored(applySurfaceChange(editorOf('# a\n\nb'), 'ab'))).toBe('# ab');
  });
});

describe('setEditorSelection', () => {
  it('clamps, orders and clears pending marks', () => {
    const armed = toggleEditorMark(editorOf('ab', { start: 2, end: 2 }), 'bold');
    const moved = setEditorSelection(armed, { start: 9, end: 1 });

    expect(moved.selection).toEqual({ start: 1, end: 2 });
    expect(moved.pendingMarks).toBeNull();
  });

  it('returns the same state when nothing changes', () => {
    const state = editorOf('ab', { start: 1, end: 1 });

    expect(setEditorSelection(state, { start: 1, end: 1 })).toBe(state);
  });
});

describe('toggleEditorMark', () => {
  it('adds and removes marks over a range', () => {
    expect(stored(toggleEditorMark(editorOf('hello'), 'bold', { start: 1, end: 4 }))).toBe(
      'h**ell**o',
    );
    expect(stored(toggleEditorMark(editorOf('**hello**'), 'bold', { start: 0, end: 5 }))).toBe(
      'hello',
    );
  });

  it('splits partially covered spans', () => {
    expect(stored(toggleEditorMark(editorOf('**ab**cd'), 'bold', { start: 1, end: 3 }))).toBe(
      '**abc**d',
    );
  });

  it('toggles each block of a multi-block range independently', () => {
    expect(stored(toggleEditorMark(editorOf('**a**\n\n*b*'), 'bold', { start: 0, end: 4 }))).toBe(
      'a\n\n***b***',
    );
  });

  it('is a no-op over separators only', () => {
    const state = editorOf('a\n\nb');

    expect(toggleEditorMark(state, 'bold', { start: 1, end: 3 })).toBe(state);
  });

  it('arms pending marks on a collapsed caret, honoring a second toggle', () => {
    const armed = toggleEditorMark(editorOf('ab', { start: 1, end: 1 }), 'bold');

    expect(armed.pendingMarks).toEqual(['bold']);
    expect(toggleEditorMark(armed, 'bold').pendingMarks).toEqual([]);
  });

  it('types plain inside bold text after toggling bold off at the caret', () => {
    const armed = toggleEditorMark(editorOf('**ab**', { start: 1, end: 1 }), 'bold');

    expect(armed.pendingMarks).toEqual([]);
    expect(stored(applySurfaceChange(armed, 'axb'))).toBe('**a**x**b**');
  });

  it('defaults to the state selection and clamps wild ranges', () => {
    expect(stored(toggleEditorMark(editorOf('ab', { start: 0, end: 2 }), 'bold'))).toBe('**ab**');
    expect(stored(toggleEditorMark(editorOf('ab'), 'bold', { start: 5, end: -5 }))).toBe('**ab**');
  });
});

describe('toggleEditorHeading', () => {
  it('cycles the caret block through plain, H1, H2, H3 and back', () => {
    let state = editorOf('text', { start: 2, end: 2 });

    state = toggleEditorHeading(state);
    expect(stored(state)).toBe('# text');
    state = toggleEditorHeading(state);
    expect(stored(state)).toBe('## text');
    state = toggleEditorHeading(state);
    expect(stored(state)).toBe('### text');
    state = toggleEditorHeading(state);
    expect(stored(state)).toBe('text');
  });

  it('touches only the targeted block, resolving separator offsets backwards', () => {
    expect(stored(toggleEditorHeading(editorOf('a\n\nb'), 4))).toBe('a\n\n# b');
    expect(stored(toggleEditorHeading(editorOf('a\n\nb'), 2))).toBe('# a\n\nb');
    expect(stored(toggleEditorHeading(editorOf('ab'), 99))).toBe('# ab');
  });

  it('creates a heading block in an empty document', () => {
    const state = toggleEditorHeading(editorOf(''));

    expect(getSurfaceText(state)).toBe('');
    expect(getEditorActiveMarks(state).heading).toBe(1);
  });
});

describe('getEditorActiveMarks', () => {
  it('reads marks at the caret, preferring the preceding char', () => {
    expect(getEditorActiveMarks(editorOf('**ab**', { start: 1, end: 1 }))).toEqual({
      marks: ['bold'],
      heading: 0,
    });
    expect(getEditorActiveMarks(editorOf('**ab**', { start: 0, end: 0 })).marks).toEqual(['bold']);
    expect(getEditorActiveMarks(editorOf('**a**b', { start: 1, end: 1 })).marks).toEqual(['bold']);
  });

  it('intersects marks over a range', () => {
    expect(getEditorActiveMarks(editorOf('**a***b*'), { start: 0, end: 2 }).marks).toEqual([]);
    expect(getEditorActiveMarks(editorOf('**a***b*'), { start: 0, end: 1 }).marks).toEqual([
      'bold',
    ]);
  });

  it('prefers pending marks and reports heading levels', () => {
    const armed = toggleEditorMark(editorOf('ab', { start: 1, end: 1 }), 'italic');

    expect(getEditorActiveMarks(armed).marks).toEqual(['italic']);
    expect(getEditorActiveMarks(editorOf('# T', { start: 1, end: 1 })).heading).toBe(1);
    expect(getEditorActiveMarks(editorOf(''))).toEqual({ marks: [], heading: 0 });
  });
});
