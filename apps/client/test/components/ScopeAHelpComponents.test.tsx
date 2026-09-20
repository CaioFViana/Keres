import { fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { HelpFieldTable } from '../../src/components/features/help/HelpFieldTable/HelpFieldTable';
import { HelpSearchBar } from '../../src/components/features/help/HelpSearchBar/HelpSearchBar';
import { HighlightedText } from '../../src/components/features/help/HelpSearchBar/HighlightedText';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: { background: '#fff', border: '#ddd', surface: '#fff', text: '#111' },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function highlightedNodes(view: RenderResult, color: string) {
  return view.container.queryAll((node) => {
    const style = node.props?.style;
    if (style == null || typeof style !== 'object') return false;
    return StyleSheet.flatten(style)?.backgroundColor === color;
  });
}

function highlightedText(view: RenderResult, color: string) {
  const hits = highlightedNodes(view, color);
  return hits.some(
    (node) =>
      Array.isArray(node.children) &&
      node.children.some((child) => child === 'Café' || child === 'Chapter'),
  );
}

describe('HelpFieldTable', () => {
  it('renders the header and every row', async () => {
    const view = await render(
      <HelpFieldTable
        rows={[
          { key: 'name', label: 'Name', whatToWrite: 'The name', note: 'Required' },
          { key: 'notes', label: 'Notes', whatToWrite: 'Anything', note: undefined },
        ]}
      />,
    );

    expect(view.getByText('help_field_column_name')).toBeTruthy();
    expect(view.getByText('help_field_column_write')).toBeTruthy();
    expect(view.getByText('help_field_column_note')).toBeTruthy();
    expect(view.getByText('Name')).toBeTruthy();
    expect(view.getByText('The name')).toBeTruthy();
    expect(view.getByText('Required')).toBeTruthy();
    expect(view.getByText('Anything')).toBeTruthy();
  });
});

describe('HelpSearchBar', () => {
  const baseProps = {
    value: '',
    onChangeText: jest.fn(),
    onClear: jest.fn(),
    placeholder: 'Search help',
    clearAccessibilityLabel: 'Clear search',
    color: '#111',
    borderColor: '#ddd',
  };

  beforeEach(() => jest.clearAllMocks());

  it('edits the query and clears it', async () => {
    const onChangeText = jest.fn();
    const onClear = jest.fn();
    const view = await render(
      <HelpSearchBar {...baseProps} value="cha" onChangeText={onChangeText} onClear={onClear} />,
    );

    await fireEvent.changeText(view.getByLabelText('Search help'), 'chap');
    expect(onChangeText).toHaveBeenCalledWith('chap');

    await fireEvent.press(view.getByLabelText('Clear search'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('hides the clear button when empty', async () => {
    const view = await render(<HelpSearchBar {...baseProps} />);

    expect(view.queryByLabelText('Clear search')).toBeNull();
  });
});

describe('HighlightedText', () => {
  it('highlights a case-insensitive match', async () => {
    const view = await render(
      <HighlightedText text="Chapter One" query="chapter" highlightColor="#ff0" />,
    );

    expect(highlightedNodes(view, '#ff0').length).toBeGreaterThan(0);
    expect(highlightedText(view, '#ff0')).toBe(true);
  });

  it('matches across accents', async () => {
    const view = await render(
      <HighlightedText text="Café com pão" query="cafe" highlightColor="#ff0" />,
    );

    expect(highlightedNodes(view, '#ff0').length).toBeGreaterThan(0);
    expect(highlightedText(view, '#ff0')).toBe(true);
  });

  it('renders plain text without a match or query', async () => {
    const missed = await render(
      <HighlightedText text="Chapter One" query="zzz" highlightColor="#ff0" />,
    );
    expect(highlightedNodes(missed, '#ff0')).toHaveLength(0);
    expect(missed.getByText('Chapter One')).toBeTruthy();

    const blank = await render(
      <HighlightedText text="Chapter One" query="" highlightColor="#ff0" />,
    );
    expect(highlightedNodes(blank, '#ff0')).toHaveLength(0);
  });
});
