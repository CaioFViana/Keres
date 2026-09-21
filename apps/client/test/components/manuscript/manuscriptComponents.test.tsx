import { parseMarkdownToDocument } from '@keres/shared';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { manuscriptTextMetrics } from '../../../src/components/features/manuscript/manuscriptTextMetrics';
import { MarkdownPreview } from '../../../src/components/features/manuscript/MarkdownPreview/MarkdownPreview';
import { RichBodyEditor } from '../../../src/components/features/manuscript/RichBodyEditor/RichBodyEditor';
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
    maxLength: 30000,
    overLimit: false,
    canSave: true,
    saving: false,
    hasUnsavedChanges: false,
    onSave: jest.fn(),
    testID: 'footer',
    ...overrides,
  };
}

describe('SceneBodyEditor', () => {
  it('renders the value and forwards typing and selection', async () => {
    const onChangeText = jest.fn();
    const onSelectionChange = jest.fn();
    const view = await render(
      <SceneBodyEditor
        doc={parseMarkdownToDocument('hello world')}
        surfaceText="hello world"
        onChangeText={onChangeText}
        selection={{ start: 0, end: 5 }}
        onSelectionChange={onSelectionChange}
        testID="editor"
      />,
    );

    const input = view.getByTestId('editor.input');
    expect(input.props.value).toBe('hello world');
    expect(input.props.selection).toEqual({ start: 0, end: 5 });
    await fireEvent.changeText(input, 'hello world!');
    expect(onChangeText).toHaveBeenCalledWith('hello world!');
    await fireEvent(input, 'selectionChange', { nativeEvent: { selection: { start: 6, end: 11 } } });
    expect(onSelectionChange).toHaveBeenCalledWith({ start: 6, end: 11 });
  });

  it('uses the shared manuscript metrics for a seamless preview swap', async () => {
    const view = await render(
      <SceneBodyEditor
        doc={parseMarkdownToDocument('hello')}
        surfaceText="hello"
        onChangeText={jest.fn()}
        testID="editor"
      />,
    );

    const style = StyleSheet.flatten(view.getByTestId('editor.input').props.style);
    expect(style.fontSize).toBe(manuscriptTextMetrics.fontSize);
    expect(style.lineHeight).toBe(manuscriptTextMetrics.lineHeight);
    const overlayStyle = StyleSheet.flatten(view.getByTestId('editor.overlay').props.style);
    expect(overlayStyle.fontSize).toBe(manuscriptTextMetrics.fontSize);
    expect(overlayStyle.lineHeight).toBe(manuscriptTextMetrics.lineHeight);
  });
});

describe('RichBodyEditor', () => {
  const DOC = parseMarkdownToDocument('## Chapter\n\nA **bold** and ~~cut~~ line.');
  const SURFACE = 'Chapter\n\nA bold and cut line.';

  function overlaySource(overlay: { props: { children?: unknown } }): string {
    const children = overlay.props.children;
    const list = Array.isArray(children) ? children : children == null ? [] : [children];
    return list
      .map((child) =>
        typeof child === 'string'
          ? child
          : ((child as React.ReactElement<{ children?: string }>).props.children ?? ''),
      )
      .join('');
  }

  it('mirrors the surface char-for-char in a single overlay Text', async () => {
    const view = await render(
      <RichBodyEditor doc={DOC} surfaceText={SURFACE} onChangeText={jest.fn()} testID="editor" />,
    );

    expect(overlaySource(view.getByTestId('editor.overlay'))).toBe(SURFACE);
  });

  it('renders an empty overlay for empty text without breaking the input', async () => {
    const view = await render(
      <RichBodyEditor
        doc={parseMarkdownToDocument('')}
        surfaceText=""
        onChangeText={jest.fn()}
        testID="editor"
      />,
    );

    expect(overlaySource(view.getByTestId('editor.overlay'))).toBe('');
    expect(view.getByTestId('editor.input').props.value).toBe('');
  });

  it('renders content spans with rich styles and no markers anywhere', async () => {
    const view = await render(
      <RichBodyEditor doc={DOC} surfaceText={SURFACE} onChangeText={jest.fn()} testID="editor" />,
    );

    expect(view.queryByText('**')).toBeNull();
    expect(view.queryByText('##')).toBeNull();
    expect(view.queryByText('~~')).toBeNull();
    expect(StyleSheet.flatten(view.getByText('bold').props.style).fontWeight).toBe('700');
    expect(StyleSheet.flatten(view.getByText('cut').props.style).textDecorationLine).toBe(
      'line-through',
    );
    expect(StyleSheet.flatten(view.getByText('Chapter').props.style).fontSize).toBe(
      Math.round(
        manuscriptTextMetrics.fontSize * manuscriptTextMetrics.headingScale[2],
      ),
    );
  });

  it('keeps the input transparent with theme caret/selection over identical metrics', async () => {
    const view = await render(
      <RichBodyEditor doc={DOC} surfaceText={SURFACE} onChangeText={jest.fn()} testID="editor" />,
    );

    const input = view.getByTestId('editor.input');
    const inputStyle = StyleSheet.flatten(input.props.style);
    expect(inputStyle.color).toBe('transparent');
    expect(inputStyle.backgroundColor).toBe('transparent');
    expect(input.props.selectionColor).toBe('#00f');
    expect(input.props.cursorColor).toBe('#00f');
    expect(input.props.multiline).toBe(true);
    expect(input.props.scrollEnabled).toBe(false);
    expect(inputStyle.textAlignVertical).toBe('top');

    const overlayStyle = StyleSheet.flatten(view.getByTestId('editor.overlay').props.style);
    expect(overlayStyle.fontSize).toBe(manuscriptTextMetrics.fontSize);
    expect(overlayStyle.lineHeight).toBe(manuscriptTextMetrics.lineHeight);
    expect(overlayStyle.paddingHorizontal).toBe(
      manuscriptTextMetrics.containerPaddingHorizontal,
    );
    expect(overlayStyle.paddingVertical).toBe(manuscriptTextMetrics.containerPaddingVertical);
    expect(inputStyle.fontSize).toBe(overlayStyle.fontSize);
    expect(inputStyle.lineHeight).toBe(overlayStyle.lineHeight);
    expect(inputStyle.paddingHorizontal).toBe(overlayStyle.paddingHorizontal);
    expect(inputStyle.paddingVertical).toBe(overlayStyle.paddingVertical);
  });

  it('leaves the input as the sole touch target', async () => {
    const view = await render(
      <RichBodyEditor doc={DOC} surfaceText={SURFACE} onChangeText={jest.fn()} testID="editor" />,
    );

    expect(view.getByTestId('editor.overlay').parent!.props.pointerEvents).toBe('none');
  });
});

describe('SceneBodyToolbar', () => {
  it.each([
    ['bold', 'B'],
    ['italic', 'I'],
    ['underline', 'U'],
    ['heading', 'H'],
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
    expect(StyleSheet.flatten(view.getByText('H').props.style).color).toBe('#111');
    expect(view.getByTestId('toolbar.bold').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(view.getByTestId('toolbar.italic').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('renders every glyph in the text color without actives', async () => {
    const view = await render(<SceneBodyToolbar onAction={jest.fn()} testID="toolbar" />);

    for (const glyph of ['B', 'I', 'U', 'H', 'S']) {
      expect(StyleSheet.flatten(view.getByText(glyph).props.style).color).toBe('#111');
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

  it('nudges a split on large scenes and warns when too large', async () => {
    const large = await render(<SceneBodyFooter {...footerProps({ sizeStatus: 'large' })} />);
    expect(large.getByText('manuscript_size_large')).toBeTruthy();
    expect(large.queryByText('manuscript_size_too_large')).toBeNull();

    const tooLarge = await render(<SceneBodyFooter {...footerProps({ sizeStatus: 'tooLarge' })} />);
    expect(tooLarge.getByText('manuscript_size_too_large')).toBeTruthy();
    expect(tooLarge.queryByText('manuscript_size_large')).toBeNull();
  });

  it('prefers the blocking cap hint over the advisory size bands', async () => {
    const view = await render(
      <SceneBodyFooter {...footerProps({ overLimit: true, sizeStatus: 'tooLarge' })} />,
    );

    expect(view.getByText('manuscript_split_hint')).toBeTruthy();
    expect(view.queryByText('manuscript_size_too_large')).toBeNull();
    expect(view.queryByText('manuscript_size_large')).toBeNull();
  });

  it('announces a running save', async () => {
    const view = await render(<SceneBodyFooter {...footerProps({ saving: true })} />);

    expect(view.getByText('saving')).toBeTruthy();
  });
});

describe('MarkdownPreview', () => {
  it('renders paragraphs and headings with inline styles', async () => {
    const view = await render(
      <MarkdownPreview
        text={'## Chapter\n\nA **bold**, *soft* and __lined__ line.'}
        testID="preview"
      />,
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

  it('renders body text with the shared manuscript metrics', async () => {
    const view = await render(<MarkdownPreview text="Just prose." testID="preview" />);

    // getByText matches the inner span; the paragraph metrics live on its host parent.
    const paragraph = view.getByText('Just prose.').parent!;
    const style = StyleSheet.flatten(paragraph.props.style);
    expect(style.fontSize).toBe(manuscriptTextMetrics.fontSize);
    expect(style.lineHeight).toBe(manuscriptTextMetrics.lineHeight);
  });
});
