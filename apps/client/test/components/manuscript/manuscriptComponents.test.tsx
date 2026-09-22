import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import type { EnrichedTextInputInstance } from 'react-native-enriched-html';
import { manuscriptTextMetrics } from '../../../src/components/features/manuscript/manuscriptTextMetrics';
import { MarkdownPreview } from '../../../src/components/features/manuscript/MarkdownPreview/MarkdownPreview';
import {
  RICH_BODY_EDITOR_WEB_CSS,
  RichBodyEditor,
} from '../../../src/components/features/manuscript/RichBodyEditor/RichBodyEditor';
import { SceneBodyEditor } from '../../../src/components/features/manuscript/SceneBodyEditor/SceneBodyEditor';
import { SceneBodyFooter } from '../../../src/components/features/manuscript/SceneBodyFooter/SceneBodyFooter';
import { SceneBodyToolbar } from '../../../src/components/features/manuscript/SceneBodyToolbar/SceneBodyToolbar';

jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      notification: '#fa0',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#ccf',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

function footerProps(
  overrides: Partial<React.ComponentProps<typeof SceneBodyFooter>> = {},
): React.ComponentProps<typeof SceneBodyFooter> {
  return {
    wordCount: 2,
    charCount: 11,
    sizeStatus: 'ok',
    overLimit: false,
    canSave: true,
    saving: false,
    hasUnsavedChanges: false,
    onSave: jest.fn(),
    testID: 'footer',
    ...overrides,
  };
}

function marksState(active: {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeThrough?: boolean;
}) {
  const state = (on?: boolean) => ({ isActive: on ?? false, isConflicting: false, isBlocking: false });
  return {
    bold: state(active.bold),
    italic: state(active.italic),
    underline: state(active.underline),
    strikeThrough: state(active.strikeThrough),
  };
}

describe('SceneBodyEditor', () => {
  it('seeds and forwards HTML and marks through the alias', async () => {
    const onHtmlChange = jest.fn();
    const onMarksChange = jest.fn();
    const view = await render(
      <SceneBodyEditor
        defaultHtml="<html><p>hello world</p></html>"
        onHtmlChange={onHtmlChange}
        onMarksChange={onMarksChange}
        testID="editor"
      />,
    );

    const input = view.getByTestId('editor.input');
    expect(input.props.defaultValue).toBe('<html><p>hello world</p></html>');
    await fireEvent(input, 'changeHtml', {
      nativeEvent: { value: '<html><p>hello world!</p></html>' },
    });
    expect(onHtmlChange).toHaveBeenCalledWith('<html><p>hello world!</p></html>');
    await fireEvent(input, 'changeState', { nativeEvent: marksState({ italic: true }) });
    expect(onMarksChange).toHaveBeenCalledWith(['italic']);
  });

  it('uses the shared manuscript metrics for a seamless preview swap', async () => {
    const view = await render(
      <SceneBodyEditor
        defaultHtml="<html><p>hello</p></html>"
        onHtmlChange={jest.fn()}
        onMarksChange={jest.fn()}
        testID="editor"
      />,
    );

    const style = StyleSheet.flatten(view.getByTestId('editor.input').props.style);
    expect(style.fontSize).toBe(manuscriptTextMetrics.fontSize);
    expect(style.lineHeight).toBe(manuscriptTextMetrics.lineHeight);
  });
});

describe('RichBodyEditor', () => {
  const HTML = '<html><p>Prologue</p><p><b>bold</b> and <s>cut</s> line.</p></html>';

  function renderEditor(overrides: Partial<React.ComponentProps<typeof RichBodyEditor>> = {}) {
    return render(
      <RichBodyEditor
        defaultHtml={HTML}
        onHtmlChange={jest.fn()}
        onMarksChange={jest.fn()}
        testID="editor"
        {...overrides}
      />,
    );
  }

  it('seeds the native editor with HTML and streams edits back out', async () => {
    const onHtmlChange = jest.fn();
    const view = await renderEditor({ onHtmlChange });

    const input = view.getByTestId('editor.input');
    expect(input.props.defaultValue).toBe(HTML);
    await fireEvent(input, 'changeHtml', { nativeEvent: { value: '<html><p>hi</p></html>' } });
    expect(onHtmlChange).toHaveBeenCalledWith('<html><p>hi</p></html>');
  });

  it('maps native style state to manuscript marks', async () => {
    const onMarksChange = jest.fn();
    const view = await renderEditor({ onMarksChange });

    const input = view.getByTestId('editor.input');
    await fireEvent(input, 'changeState', {
      nativeEvent: marksState({ bold: true, strikeThrough: true }),
    });
    expect(onMarksChange).toHaveBeenCalledWith(['bold', 'strikethrough']);
    await fireEvent(input, 'changeState', { nativeEvent: marksState({}) });
    expect(onMarksChange).toHaveBeenCalledWith([]);
  });

  it('renders empty HTML without breaking the input', async () => {
    const view = await renderEditor({ defaultHtml: '' });

    expect(view.getByTestId('editor.input').props.defaultValue).toBe('');
  });

  it('freezes the seed while mounted so the web host never rebuilds mid-edit', async () => {
    const onHtmlChange = jest.fn();
    const onMarksChange = jest.fn();
    const view = await renderEditor({ onHtmlChange, onMarksChange });

    await view.rerender(
      <RichBodyEditor
        defaultHtml="<html><p>live doc changed after a keystroke</p></html>"
        onHtmlChange={onHtmlChange}
        onMarksChange={onMarksChange}
        testID="editor"
      />,
    );

    expect(view.getByTestId('editor.input').props.defaultValue).toBe(HTML);
  });

  it('remounts on web when permission flips so read-only never sticks', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      const onHtmlChange = jest.fn();
      const onMarksChange = jest.fn();
      const view = await renderEditor({
        editable: false,
        canEdit: false,
        onHtmlChange,
        onMarksChange,
      });

      const reseeded = '<html><p>typed while the role resolved</p></html>';
      await view.rerender(
        <RichBodyEditor
          defaultHtml={reseeded}
          onHtmlChange={onHtmlChange}
          onMarksChange={onMarksChange}
          editable
          canEdit
          testID="editor"
        />,
      );

      // Same mounted input would keep the frozen seed; the remount reseeds
      // from the live doc, so nothing typed is lost.
      expect(view.getByTestId('editor.input').props.defaultValue).toBe(reseeded);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('does not remount on web for transient editable flips while saving', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      const onHtmlChange = jest.fn();
      const onMarksChange = jest.fn();
      const view = await renderEditor({
        editable: true,
        canEdit: true,
        onHtmlChange,
        onMarksChange,
      });

      // A save flips editable twice around the same permission: remounting
      // there overlaps with the host's async seed application, and the loser
      // (an empty transient emit) wipes the doc.
      await view.rerender(
        <RichBodyEditor
          defaultHtml="<html><p>saving started</p></html>"
          onHtmlChange={onHtmlChange}
          onMarksChange={onMarksChange}
          editable={false}
          canEdit
          testID="editor"
        />,
      );
      await view.rerender(
        <RichBodyEditor
          defaultHtml="<html><p>saving finished</p></html>"
          onHtmlChange={onHtmlChange}
          onMarksChange={onMarksChange}
          editable
          canEdit
          testID="editor"
        />,
      );

      expect(view.getByTestId('editor.input').props.defaultValue).toBe(HTML);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('locks pointer input while permitted-but-disabled, nowhere else', async () => {
    const cases: {
      name: string;
      editable?: boolean;
      canEdit?: boolean;
      locked: boolean;
    }[] = [
      { name: 'editing', editable: true, canEdit: true, locked: false },
      { name: 'saving', editable: false, canEdit: true, locked: true },
      { name: 'reader', editable: false, canEdit: false, locked: false },
      { name: 'defaults', editable: undefined, canEdit: undefined, locked: false },
    ];
    for (const { editable, canEdit, locked } of cases) {
      const view = await renderEditor({ editable, canEdit });
      expect(view.getByTestId('editor').props.pointerEvents).toBe(locked ? 'none' : 'auto');
      await view.unmount();
    }
  });

  it('uses the app system stack on web and inherits it on native', async () => {
    const nativeStyle = StyleSheet.flatten(
      (await renderEditor()).getByTestId('editor.input').props.style,
    );
    expect(nativeStyle.fontFamily).toBeUndefined();
    expect(nativeStyle.paddingHorizontal).toBe(
      manuscriptTextMetrics.containerPaddingHorizontal,
    );
    expect(nativeStyle.paddingVertical).toBe(manuscriptTextMetrics.containerPaddingVertical);

    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      const webStyle = StyleSheet.flatten(
        (await renderEditor()).getByTestId('editor.input').props.style,
      );
      expect(webStyle.fontFamily).toBe(manuscriptTextMetrics.webFontFamily);
      // Padding moves to the inner contenteditable via scoped CSS so padding
      // clicks land inside the editable and focus it.
      expect(webStyle.paddingHorizontal).toBe(0);
      expect(webStyle.paddingVertical).toBe(0);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('scopes inner-host CSS to the container id on web only', async () => {
    const { containerPaddingHorizontal: ph, containerPaddingVertical: pv } =
      manuscriptTextMetrics;
    expect(RICH_BODY_EDITOR_WEB_CSS).toBe(
      '#keres-rich-body-editor>div{display:flex;flex-direction:column}' +
        `#keres-rich-body-editor .ProseMirror{flex:1;padding:${pv}px ${ph}px}` +
        '#keres-rich-body-editor .ProseMirror:focus{outline:none}',
    );
    const nativeView = await renderEditor();
    expect(nativeView.getByTestId('editor').props.id).toBe('keres-rich-body-editor');
    expect(JSON.stringify(nativeView.toJSON())).not.toContain('ProseMirror');

    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      const webView = await renderEditor();
      expect(JSON.stringify(webView.toJSON())).toContain(RICH_BODY_EDITOR_WEB_CSS);
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });

  it('attaches the host input ref for toolbar toggles', async () => {
    const enrichedMock = jest.requireMock('react-native-enriched-html') as {
      __enrichedTest: { refHolder: { current: unknown } };
    };
    const inputRef = React.createRef<EnrichedTextInputInstance>();
    await renderEditor({ inputRef });

    expect(enrichedMock.__enrichedTest.refHolder.current).toBe(inputRef);
  });

  it('keeps theme selection over the shared manuscript metrics', async () => {
    const view = await renderEditor();

    const input = view.getByTestId('editor.input');
    const inputStyle = StyleSheet.flatten(input.props.style);
    expect(input.props.selectionColor).toBe('#00f');
    // No explicit caret color: the OS default caret draws over visible text.
    expect(input.props.cursorColor).toBeUndefined();
    expect(input.props.scrollEnabled).toBe(false);
    expect(input.props.linkRegex).toBeNull();
    expect(inputStyle.color).toBe('#111');
    expect(inputStyle.fontSize).toBe(manuscriptTextMetrics.fontSize);
    expect(inputStyle.lineHeight).toBe(manuscriptTextMetrics.lineHeight);
    expect(inputStyle.paddingHorizontal).toBe(manuscriptTextMetrics.containerPaddingHorizontal);
    expect(inputStyle.paddingVertical).toBe(manuscriptTextMetrics.containerPaddingVertical);
  });
});

describe('SceneBodyToolbar', () => {
  it.each([
    ['bold', 'B'],
    ['italic', 'I'],
    ['underline', 'U'],
    ['strikethrough', 'S'],
  ] as const)('dispatches %s from its button', async (kind, glyph) => {
    const onAction = jest.fn();
    const view = await render(<SceneBodyToolbar onAction={onAction} testID="toolbar" />);

    expect(view.getByText(glyph)).toBeTruthy();
    await fireEvent.press(view.getByTestId(`toolbar.${kind}`));
    expect(onAction).toHaveBeenCalledWith(kind);
  });

  it('renders the strikethrough glyph with a line-through', async () => {
    const view = await render(<SceneBodyToolbar onAction={jest.fn()} testID="toolbar" />);

    const style = StyleSheet.flatten(view.getByText('S').props.style);
    expect(style.textDecorationLine).toBe('line-through');
  });

  it('highlights active formats with the primary color', async () => {
    const view = await render(
      <SceneBodyToolbar
        onAction={jest.fn()}
        active={{ bold: true, strikethrough: true }}
        testID="toolbar"
      />,
    );

    expect(StyleSheet.flatten(view.getByText('B').props.style).color).toBe('#00f');
    expect(StyleSheet.flatten(view.getByText('S').props.style).color).toBe('#00f');
    expect(StyleSheet.flatten(view.getByText('I').props.style).color).toBe('#111');
    expect(StyleSheet.flatten(view.getByText('U').props.style).color).toBe('#111');
    expect(view.getByTestId('toolbar.bold').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(view.getByTestId('toolbar.italic').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('renders every glyph in the text color without actives', async () => {
    const view = await render(<SceneBodyToolbar onAction={jest.fn()} testID="toolbar" />);

    for (const glyph of ['B', 'I', 'U', 'S']) {
      expect(StyleSheet.flatten(view.getByText(glyph).props.style).color).toBe('#111');
    }
  });

  it('never steals the editor input focus', async () => {
    const view = await render(<SceneBodyToolbar onAction={jest.fn()} testID="toolbar" />);

    for (const kind of ['bold', 'italic', 'underline', 'strikethrough']) {
      expect(view.getByTestId(`toolbar.${kind}`).props.focusable).toBe(false);
    }
  });
});

describe('SceneBodyFooter', () => {
  it('shows the counter and saves on press', async () => {
    const onSave = jest.fn();
    const view = await render(<SceneBodyFooter {...footerProps({ onSave })} />);

    expect(view.getByText('manuscript_counter')).toBeTruthy();
    await fireEvent.press(view.getByText('save'));
    expect(onSave).toHaveBeenCalled();
  });

  it('flags unsaved changes and the over-limit hint', async () => {
    const view = await render(
      <SceneBodyFooter {...footerProps({ hasUnsavedChanges: true, overLimit: true })} />,
    );

    expect(view.getByText('manuscript_unsaved_draft')).toBeTruthy();
    expect(view.getByText('manuscript_split_hint')).toBeTruthy();
  });

  it('warns on large scenes without any size band above it', async () => {
    const large = await render(<SceneBodyFooter {...footerProps({ sizeStatus: 'large' })} />);
    expect(large.getByText('manuscript_size_large')).toBeTruthy();
  });

  it('prefers the over-cap hint over the advisory warning', async () => {
    const view = await render(
      <SceneBodyFooter {...footerProps({ overLimit: true, sizeStatus: 'large' })} />,
    );

    expect(view.getByText('manuscript_split_hint')).toBeTruthy();
    expect(view.queryByText('manuscript_size_large')).toBeNull();
  });

  it('announces a running save', async () => {
    const view = await render(<SceneBodyFooter {...footerProps({ saving: true })} />);

    expect(view.getByText('saving')).toBeTruthy();
  });
});

describe('MarkdownPreview', () => {
  it('renders paragraphs with inline styles', async () => {
    const view = await render(
      <MarkdownPreview text={'Chapter\n\nA **bold**, *soft* and __lined__ line.'} testID="preview" />,
    );

    expect(view.getByText('Chapter')).toBeTruthy();
    expect(view.getByText('bold')).toBeTruthy();
    expect(view.getByText('soft')).toBeTruthy();
    const lined = StyleSheet.flatten(view.getByText('lined').props.style);
    expect(lined.textDecorationLine).toBe('underline');
  });

  it('renders strikethrough spans with a line-through', async () => {
    const view = await render(<MarkdownPreview text={'A ~~cut~~ line.'} testID="preview" />);

    const cut = StyleSheet.flatten(view.getByText('cut').props.style);
    expect(cut.textDecorationLine).toBe('line-through');
  });

  it('renders combined marks exactly as the editor stores them', async () => {
    const view = await render(
      <MarkdownPreview text={'A ***both*** and **__strong__** word.'} testID="preview" />,
    );

    const both = StyleSheet.flatten(view.getByText('both').props.style);
    expect(both.fontWeight).toBe('700');
    expect(both.fontStyle).toBe('italic');
    const strong = StyleSheet.flatten(view.getByText('strong').props.style);
    expect(strong.fontWeight).toBe('700');
    expect(strong.textDecorationLine).toBe('underline');
    expect(view.queryByText('***')).toBeNull();
  });

  it('degrades legacy heading prefixes to plain paragraphs', async () => {
    const view = await render(<MarkdownPreview text={'# Old title'} testID="preview" />);

    expect(view.getByText('Old title')).toBeTruthy();
    expect(view.queryByText('# Old title')).toBeNull();
  });

  it('renders body text with the shared manuscript metrics', async () => {
    const view = await render(<MarkdownPreview text="Just prose." testID="preview" />);

    // getByText matches the inner span; the paragraph metrics live on its host parent.
    const paragraph = view.getByText('Just prose.').parent!;
    const style = StyleSheet.flatten(paragraph.props.style);
    expect(style.fontSize).toBe(manuscriptTextMetrics.fontSize);
    expect(style.lineHeight).toBe(manuscriptTextMetrics.lineHeight);
  });

  it('renders blank lines as full beats without text nodes', async () => {
    const view = await render(
      <MarkdownPreview text={'Above.\n\n\n\nBelow.'} testID="preview" />,
    );

    const root = view.getByTestId('preview');
    expect(root.children).toHaveLength(3);
    const blank = root.children[1] as unknown as {
      props: { style: ViewStyle };
      children: unknown[];
    };
    const style = StyleSheet.flatten(blank.props.style);
    expect(style.height).toBe(manuscriptTextMetrics.lineHeight);
    expect(style.marginBottom).toBeUndefined();
    expect(blank.children).toHaveLength(0);
    expect(view.getByText('Above.')).toBeTruthy();
    expect(view.getByText('Below.')).toBeTruthy();
  });

  it('trims trailing blank lines instead of airing the section end', async () => {
    const view = await render(
      <MarkdownPreview text={'Just prose.\n\n\n\n'} testID="preview" />,
    );

    expect(view.getByTestId('preview').children).toHaveLength(1);
    expect(view.getByText('Just prose.')).toBeTruthy();
  });

  it('marks every case-insensitive search hit', async () => {
    const view = await render(
      <MarkdownPreview text="Waves. Waves again." highlightQuery="waves" testID="preview" />,
    );

    const hits = view.getAllByText(/^Waves$/);
    expect(hits).toHaveLength(2);
    for (const hit of hits) {
      expect(StyleSheet.flatten(hit.props.style).backgroundColor).toBe('#ccf');
    }
  });

  it('marks hits inside styled spans without losing their marks', async () => {
    const view = await render(
      <MarkdownPreview text="A **bold** word." highlightQuery="old" testID="preview" />,
    );

    const marked = view.getByText('old');
    expect(StyleSheet.flatten(marked.props.style).backgroundColor).toBe('#ccf');
    // Bold lives on the span host the mark nests in.
    const span = StyleSheet.flatten(marked.parent!.props.style);
    expect(span.fontWeight).toBe('700');
  });

  it('leaves the tree untouched for an empty or absent query', async () => {
    const empty = await render(
      <MarkdownPreview text="Waves. Waves again." highlightQuery="" testID="preview" />,
    );
    expect(empty.getByText('Waves. Waves again.')).toBeTruthy();

    const absent = await render(
      <MarkdownPreview text="Waves. Waves again." highlightQuery="zzz" testID="preview" />,
    );
    expect(absent.getByText('Waves. Waves again.')).toBeTruthy();
  });
});
