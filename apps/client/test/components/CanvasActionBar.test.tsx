import { fireEvent, render } from '@testing-library/react-native';
import {
  CanvasActionBar,
  CanvasActionBarButton,
} from '../../src/components/features/graphs/CanvasActionBar/CanvasActionBar';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: { text: '#111' } }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name }: { name: string }) => <Text testID={`glyph-${name}`}>{name}</Text>,
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
});
