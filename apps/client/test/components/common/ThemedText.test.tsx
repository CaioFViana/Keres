jest.mock('../../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      text: '#111111',
      textSecondary: '#555555',
      primary: '#0000ff',
      error: '#ff0000',
      onPrimary: '#ffffff',
    },
  }),
}));

import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import ThemedText from '../../../src/components/common/display/ThemedText/ThemedText';
import { typography } from '../../../src/theme/tokens';

const styleOf = (view: Awaited<ReturnType<typeof render>>, text: string) =>
  StyleSheet.flatten(view.getByText(text).props.style);

describe('ThemedText', () => {
  it('reads in the body colour unless told otherwise', async () => {
    const view = await render(<ThemedText>Plain</ThemedText>);

    expect(styleOf(view, 'Plain')).toEqual({ color: '#111111' });
  });

  it.each([
    ['secondary', '#555555'],
    ['primary', '#0000ff'],
    ['error', '#ff0000'],
    ['onPrimary', '#ffffff'],
  ] as const)('takes the %s colour from the palette', async (tone, color) => {
    const view = await render(<ThemedText tone={tone}>Words</ThemedText>);

    expect(styleOf(view, 'Words').color).toBe(color);
  });

  it('adds the size and weight of a step of the type scale', async () => {
    const view = await render(
      <ThemedText variant="title" tone="primary">
        Heading
      </ThemedText>,
    );

    expect(styleOf(view, 'Heading')).toMatchObject({ ...typography.title, color: '#0000ff' });
  });

  it('lets the caller style win, so a margin or another weight rides along', async () => {
    const view = await render(
      <ThemedText variant="title" style={{ marginBottom: 8, fontSize: 30, color: '#abcdef' }}>
        Custom
      </ThemedText>,
    );

    expect(styleOf(view, 'Custom')).toMatchObject({
      marginBottom: 8,
      fontSize: 30,
      color: '#abcdef',
      fontWeight: typography.title.fontWeight,
    });
  });

  it('passes the rest of the Text props through', async () => {
    const view = await render(
      <ThemedText numberOfLines={2} testID="note" accessibilityRole="header">
        Props
      </ThemedText>,
    );

    const node = view.getByTestId('note');
    expect(node.props.numberOfLines).toBe(2);
    expect(node.props.accessibilityRole).toBe('header');
  });
});
