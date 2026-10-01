import { fireEvent, render } from '@testing-library/react-native';
import {
  CanvasActionBar,
  CanvasActionBarButton,
} from '../../src/components/features/graphs/CanvasActionBar/CanvasActionBar';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: { text: '#111', textSecondary: '#555', primary: '#00f' } }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name, color }: { name: string; color: string }) => (
      <Text testID={`glyph-${name}`} color={color}>
        {name}
      </Text>
    ),
  };
});

describe('CanvasActionBar', () => {
  it('fires each icon button with its accessibility label', async () => {
    const onFirst = jest.fn();
    const onSecond = jest.fn();
    const view = await render(
      <CanvasActionBar>
        <CanvasActionBarButton
          testID="action-first"
          icon="image-outline"
          label="Add background image"
          onPress={onFirst}
        />
        <CanvasActionBarButton
          testID="action-second"
          icon="pin-outline"
          label="Add marker"
          onPress={onSecond}
        />
      </CanvasActionBar>,
    );

    expect(view.getByLabelText('Add background image')).toBeTruthy();
    expect(view.getByTestId('glyph-image-outline')).toBeTruthy();
    expect(view.getByTestId('glyph-pin-outline')).toBeTruthy();
    await fireEvent.press(view.getByTestId('action-first'));
    await fireEvent.press(view.getByTestId('action-second'));
    expect(onFirst).toHaveBeenCalledTimes(1);
    expect(onSecond).toHaveBeenCalledTimes(1);
  });

  it('tints the active mode primary and keeps disabled actions dim and silent', async () => {
    const onActive = jest.fn();
    const onDisabled = jest.fn();
    const view = await render(
      <CanvasActionBar>
        <CanvasActionBarButton
          testID="action-active"
          icon="git-merge"
          label="Connection mode"
          onPress={onActive}
          active
        />
        <CanvasActionBarButton
          testID="action-disabled"
          icon="checkmark-outline"
          label="Finish"
          onPress={onDisabled}
          disabled
        />
      </CanvasActionBar>,
    );

    expect(view.getByTestId('glyph-git-merge').props.color).toBe('#00f');
    expect(view.getByTestId('glyph-checkmark-outline').props.color).toBe('#555');
    await fireEvent.press(view.getByTestId('action-active'));
    await fireEvent.press(view.getByTestId('action-disabled'));
    expect(onActive).toHaveBeenCalledTimes(1);
    expect(onDisabled).not.toHaveBeenCalled();
  });
});
