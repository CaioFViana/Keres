import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PanResponder } from 'react-native';
import SketchSlider from '../../src/components/features/sketches/SketchSlider';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      border: '#ccc',
      text: '#111',
      textSecondary: '#666',
      primary: '#85f',
      onPrimary: '#fff',
      background: '#fff',
      error: '#d00',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('SketchSlider', () => {
  it('maps a touch along the track to the value range', async () => {
    const create = jest.spyOn(PanResponder, 'create');
    const onChange = jest.fn();
    await render(
      <SketchSlider
        testID="s"
        label="Size"
        value={1}
        min={0}
        max={100}
        valueText="1"
        onChange={onChange}
      />,
    );
    const track = screen.getByLabelText('Size');
    await fireEvent(track, 'layout', { nativeEvent: { layout: { width: 222, height: 32 } } });
    const [config] = (create as jest.Mock).mock.calls[0] as any[];
    // Thumb travel is the track minus the 22px thumb: x = 11 is the minimum, x = 211 the maximum.
    await act(async () => config.onPanResponderGrant({ nativeEvent: { locationX: 11 } }));
    expect(onChange).toHaveBeenLastCalledWith(0);
    await act(async () => config.onPanResponderMove({}, { dx: 100 }));
    expect(onChange.mock.calls.at(-1)?.[0]).toBeCloseTo(50);
    await act(async () => config.onPanResponderMove({}, { dx: 400 }));
    expect(onChange.mock.calls.at(-1)?.[0]).toBe(100);
    create.mockRestore();
  });

  it('keeps fine control at small sizes with the quadratic curve', async () => {
    const create = jest.spyOn(PanResponder, 'create');
    const onChange = jest.fn();
    await render(
      <SketchSlider
        label="Size"
        value={1}
        min={0}
        max={100}
        curve="quadratic"
        valueText="1"
        onChange={onChange}
      />,
    );
    await fireEvent(screen.getByLabelText('Size'), 'layout', {
      nativeEvent: { layout: { width: 222, height: 32 } },
    });
    const [config] = (create as jest.Mock).mock.calls[0] as any[];
    await act(async () => config.onPanResponderGrant({ nativeEvent: { locationX: 111 } }));
    // Half the track is a quarter of the range, not half of it.
    expect(onChange.mock.calls.at(-1)?.[0]).toBeCloseTo(25);
    create.mockRestore();
  });
});
