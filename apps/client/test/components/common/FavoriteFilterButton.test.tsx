import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import FavoriteFilterButton from '../../../src/components/common/controls/FavoriteFilterButton/FavoriteFilterButton';

const mockColors = {
  primary: '#111111',
  onPrimary: '#eeeeee',
  primaryContainer: '#222222',
  onPrimaryContainer: '#dddddd',
  star: '#aa8800',
  // Colors the button must not reach for: they are the ones that used to paint it.
  accent: '#00ff00',
  onAccent: '#001100',
  notification: '#ffaa00',
  onNotification: '#221100',
  secondary: '#333333',
  onSecondary: '#ffffff',
  error: '#ff0000',
  onError: '#ffffff',
};

jest.mock('../../../src/theme', () => ({
  useTheme: () => ({ isDarkMode: false, colors: mockColors }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

const look = async (state: 'all' | 'favorite' | 'not-favorite') => {
  const view = await render(<FavoriteFilterButton state={state} onPress={() => {}} />);
  const button = view.getByTestId('list-favorite-filter');
  const style = StyleSheet.flatten(button.props.style);
  const icon = view.container.queryAll((node) => node.type === 'Icon')[0];
  return { button, style, icon };
};

describe('FavoriteFilterButton', () => {
  it('rests as a primary button, like the controls beside it', async () => {
    const { style, icon } = await look('all');

    expect(style.backgroundColor).toBe(mockColors.primary);
    expect(style.borderColor).toBe('transparent');
    expect(icon.props.name).toBe('star-outline');
    expect(icon.props.color).toBe(mockColors.onPrimary);
  });

  it('marks "favorites only" with the theme star on a ringed container', async () => {
    const { style, icon } = await look('favorite');

    expect(style.backgroundColor).toBe(mockColors.primaryContainer);
    expect(style.borderColor).toBe(mockColors.star);
    expect(icon.props.name).toBe('star');
    expect(icon.props.color).toBe(mockColors.star);
  });

  it('marks "not favorites" with the theme text on the container', async () => {
    const { style, icon } = await look('not-favorite');

    expect(style.backgroundColor).toBe(mockColors.primaryContainer);
    expect(style.borderColor).toBe(mockColors.onPrimaryContainer);
    expect(icon.props.name).toBe('ban-outline');
    expect(icon.props.color).toBe(mockColors.onPrimaryContainer);
  });

  it('never paints with the accent or notification colors', async () => {
    for (const state of ['all', 'favorite', 'not-favorite'] as const) {
      const { style, icon } = await look(state);
      const used = [style.backgroundColor, style.borderColor, icon.props.color];
      expect(used).not.toContain(mockColors.accent);
      expect(used).not.toContain(mockColors.onAccent);
      expect(used).not.toContain(mockColors.notification);
      expect(used).not.toContain(mockColors.onNotification);
    }
  });

  it('says what it does to assistive technology, per state', async () => {
    expect((await look('all')).button.props.accessibilityLabel).toBe('list_favorites_filter');
    expect((await look('favorite')).button.props.accessibilityLabel).toBe('list_favorites_only');
    expect((await look('not-favorite')).button.props.accessibilityLabel).toBe('list_favorites_not');
  });

  it('forwards the press and accepts outside layout', async () => {
    const onPress = jest.fn();
    const view = await render(
      <FavoriteFilterButton state="all" onPress={onPress} style={{ marginLeft: 10 }} />,
    );

    await fireEvent.press(view.getByTestId('list-favorite-filter'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(
      StyleSheet.flatten(view.getByTestId('list-favorite-filter').props.style).marginLeft,
    ).toBe(10);
  });
});
