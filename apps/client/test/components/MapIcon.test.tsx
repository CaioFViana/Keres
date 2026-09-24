import { render } from '@testing-library/react-native';
import MapIcon from '../../src/components/common/display/MapIcon/MapIcon';

jest.mock('@expo/vector-icons', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name }: { name: string }) => <Text testID={`glyph-${name}`}>{name}</Text>,
  };
});

describe('MapIcon', () => {
  it('renders Ionicons names as font glyphs', async () => {
    const view = await render(<MapIcon name="flag" size={24} color="#ffffff" />);

    expect(view.getByTestId('glyph-flag')).toBeTruthy();
    expect(view.container.queryAll((node) => node.type === 'SkiaImageSVG')).toHaveLength(0);
  });

  it('renders the keres pack through Skia, tinted', async () => {
    const view = await render(<MapIcon name="keres:castle" size={24} color="#123456" />);

    const images = view.container.queryAll((node) => node.type === 'SkiaImageSVG');
    expect(images).toHaveLength(1);
    expect(images[0].props.svg.__mockSvg).toContain('fill="#123456"');
    expect(images[0].props.svg.__mockSvg).toContain('<path');
    expect(images[0].props.width).toBeCloseTo(24 * 0.8);
    expect(view.queryByTestId('glyph-location')).toBeNull();
  });

  it('falls back to the location glyph for unknown or missing artwork', async () => {
    const unknown = await render(<MapIcon name="fa:flag" size={24} color="#ffffff" />);
    expect(unknown.getByTestId('glyph-location')).toBeTruthy();

    const missing = await render(<MapIcon name="keres:nope" size={24} color="#ffffff" />);
    expect(missing.getByTestId('glyph-location')).toBeTruthy();
    expect(missing.container.queryAll((node) => node.type === 'SkiaImageSVG')).toHaveLength(0);
  });
});
