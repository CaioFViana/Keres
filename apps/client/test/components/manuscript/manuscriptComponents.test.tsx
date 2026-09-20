import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { manuscriptTextMetrics } from '../../../src/components/features/manuscript/manuscriptTextMetrics';
import { MarkdownPreview } from '../../../src/components/features/manuscript/MarkdownPreview/MarkdownPreview';
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

function footerProps(overrides: Partial<React.ComponentProps<typeof SceneBodyFooter>> = {}) {
  return {
    wordCount: 2,
    charCount: 11,
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
        value="hello world"
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
      <SceneBodyEditor value="hello" onChangeText={jest.fn()} testID="editor" />,
    );

    const style = StyleSheet.flatten(view.getByTestId('editor.input').props.style);
    expect(style.fontSize).toBe(manuscriptTextMetrics.fontSize);
    expect(style.lineHeight).toBe(manuscriptTextMetrics.lineHeight);
  });
});

describe('SceneBodyToolbar', () => {
  it.each([
    ['bold', 'B'],
    ['italic', 'I'],
    ['underline', 'U'],
    ['heading', 'H'],
  ] as const)('dispatches %s from its button', async (kind, glyph) => {
    const onAction = jest.fn();
    const view = await render(<SceneBodyToolbar onAction={onAction} testID="toolbar" />);

    expect(view.getByText(glyph)).toBeTruthy();
    await fireEvent.press(view.getByTestId(`toolbar.${kind}`));
    expect(onAction).toHaveBeenCalledWith(kind);
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

  it('renders body text with the shared manuscript metrics', async () => {
    const view = await render(<MarkdownPreview text="Just prose." testID="preview" />);

    // getByText matches the inner span; the paragraph metrics live on its host parent.
    const paragraph = view.getByText('Just prose.').parent!;
    const style = StyleSheet.flatten(paragraph.props.style);
    expect(style.fontSize).toBe(manuscriptTextMetrics.fontSize);
    expect(style.lineHeight).toBe(manuscriptTextMetrics.lineHeight);
  });
});
