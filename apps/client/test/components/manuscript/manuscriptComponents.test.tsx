import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { MarkdownPreview } from '../../../src/components/features/manuscript/MarkdownPreview/MarkdownPreview';
import { manuscriptTextMetrics } from '../../../src/components/features/manuscript/manuscriptTextMetrics';
import { SceneBodyEditor } from '../../../src/components/features/manuscript/SceneBodyEditor/SceneBodyEditor';

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

function editorProps(overrides: Partial<React.ComponentProps<typeof SceneBodyEditor>> = {}) {
  return {
    value: 'hello world',
    onChangeText: jest.fn(),
    wordCount: 2,
    charCount: 11,
    maxLength: 30000,
    overLimit: false,
    canSave: true,
    saving: false,
    hasUnsavedChanges: false,
    onSave: jest.fn(),
    testID: 'editor',
    ...overrides,
  };
}

describe('SceneBodyEditor', () => {
  it('renders the value and forwards typing', async () => {
    const onChangeText = jest.fn();
    const view = await render(<SceneBodyEditor {...editorProps({ onChangeText })} />);

    const input = view.getByTestId('editor.input');
    expect(input.props.value).toBe('hello world');
    await fireEvent.changeText(input, 'hello world!');
    expect(onChangeText).toHaveBeenCalledWith('hello world!');
  });

  it('shows the counter and saves on press', async () => {
    const onSave = jest.fn();
    const view = await render(<SceneBodyEditor {...editorProps({ onSave })} />);

    expect(view.getByText('manuscript_counter')).toBeTruthy();
    await fireEvent.press(view.getByText('save'));
    expect(onSave).toHaveBeenCalled();
  });

  it('flags unsaved changes and the over-limit hint', async () => {
    const view = await render(
      <SceneBodyEditor {...editorProps({ hasUnsavedChanges: true, overLimit: true })} />,
    );

    expect(view.getByText('manuscript_unsaved_draft')).toBeTruthy();
    expect(view.getByText('manuscript_split_hint')).toBeTruthy();
  });

  it('uses the shared manuscript metrics for a seamless preview swap', async () => {
    const view = await render(<SceneBodyEditor {...editorProps()} />);

    const style = StyleSheet.flatten(view.getByTestId('editor.input').props.style);
    expect(style.fontSize).toBe(manuscriptTextMetrics.fontSize);
    expect(style.lineHeight).toBe(manuscriptTextMetrics.lineHeight);
  });
});

describe('MarkdownPreview', () => {
  it('renders paragraphs and headings with inline styles', async () => {
    const view = await render(
      <MarkdownPreview text={'## Chapter\n\nA **bold** and *soft* line.'} testID="preview" />,
    );

    expect(view.getByText('Chapter')).toBeTruthy();
    expect(view.getByText('bold')).toBeTruthy();
    expect(view.getByText('soft')).toBeTruthy();
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
