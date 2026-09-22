import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import MarkedText from '../../src/components/common/display/MarkedText/MarkedText';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: { primaryContainer: '#aaf' } }),
}));

describe('MarkedText', () => {
  it('renders plain text untouched without ranges', async () => {
    const view = await render(<MarkedText text="A quiet arrival" ranges={[]} />);

    const node = view.getByText('A quiet arrival');
    expect(node.children).toEqual(['A quiet arrival']);
  });

  it('marks one range with the theme fill and keeps its neighbors plain', async () => {
    const view = await render(
      <MarkedText text="A quiet arrival" ranges={[{ start: 2, length: 5 }]} />,
    );

    expect(view.getByText('A ').children).toEqual(['A ']);
    const marked = view.getByText('quiet');
    expect(StyleSheet.flatten(marked.props.style).backgroundColor).toBe('#aaf');
    const after = view.getByText(' arrival');
    expect(StyleSheet.flatten(after.props.style ?? {}).backgroundColor).toBeUndefined();
  });

  it('marks several ranges in one pass', async () => {
    const view = await render(
      <MarkedText
        text="Waves. Waves again."
        ranges={[
          { start: 0, length: 5 },
          { start: 7, length: 5 },
        ]}
      />,
    );

    const hits = view.getAllByText(/^Waves$/);
    expect(hits).toHaveLength(2);
    for (const hit of hits) {
      expect(StyleSheet.flatten(hit.props.style).backgroundColor).toBe('#aaf');
    }
  });

  it('clamps out-of-bounds ranges instead of crashing', async () => {
    const view = await render(<MarkedText text="hi" ranges={[{ start: 1, length: 99 }]} />);

    expect(view.getByText('h')).toBeTruthy();
    expect(StyleSheet.flatten(view.getByText('i').props.style).backgroundColor).toBe('#aaf');
  });

  it('passes text props through to the host', async () => {
    const view = await render(
      <MarkedText text="A quiet arrival" ranges={[]} numberOfLines={4} testID="marked" />,
    );

    expect(view.getByTestId('marked').props.numberOfLines).toBe(4);
  });
});
