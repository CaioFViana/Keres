import { encodeSketchDocument, type SketchDocument } from '@keres/shared';
import { cleanup, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import SketchPreviewThumb from '@/src/components/features/sketches/SketchPreviewThumb';

const mockMakeSvg = jest.fn();

jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const RN = require('react-native');
  return { Ionicons: () => <RN.View testID="sketch-icon" /> };
});
jest.mock('@shopify/react-native-skia', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const RN = require('react-native');
  return {
    __esModule: true,
    Canvas: ({ children }: { children: ReactNode }) => (
      <RN.View testID="sketch-canvas">{children}</RN.View>
    ),
    ImageSVG: (props: { svg: unknown }) => {
      (global as any).__imageSvgProps = props;
      return null;
    },
    Skia: { SVG: { MakeFromString: (...args: unknown[]) => mockMakeSvg(...args) } },
  };
});

const mockTheme = {
  colors: {
    background: '#fff',
    surface: '#f4f4f4',
    text: '#111',
    textSecondary: '#555',
    border: '#ddd',
    primary: '#00f',
  },
};
jest.mock('@/src/theme', () => ({
  __esModule: true,
  // Stable across renders, like the app provider.
  useTheme: () => ({ isDarkMode: false, colors: mockTheme.colors }),
}));

const drawn = (color = '#e03131'): SketchDocument => ({
  page: { width: 200, height: 100, preset: null, background: 'paper' },
  layers: [
    {
      id: 'AAAAAAAA',
      name: 'Layer 1',
      visible: true,
      opacity: 1,
      locked: false,
      items: [
        {
          kind: 'stroke',
          brush: 'pen',
          color,
          alpha: 1,
          size: 3,
          points: [0, 0, 9, 9],
        },
      ],
    },
  ],
  overlays: [],
});

const sketchOf = (doc: SketchDocument) => ({
  name: 'Throne room',
  content: encodeSketchDocument(doc),
});
const blank = (): SketchDocument => ({
  ...drawn(),
  layers: drawn().layers.map((layer) => ({ ...layer, items: [] })),
});

const imageSvgProps = () => (global as any).__imageSvgProps as { svg: unknown } | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  delete (global as any).__imageSvgProps;
  mockMakeSvg.mockImplementation((xml: string) => ({ __xml: xml }));
  (Platform as { OS: string }).OS = 'ios';
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  (Platform as { OS: string }).OS = 'ios';
  jest.restoreAllMocks();
});

describe('SketchPreviewThumb', () => {
  it('draws the drawing under the current theme, straight from its content', async () => {
    await render(<SketchPreviewThumb sketch={sketchOf(drawn())} />);

    expect(mockMakeSvg).toHaveBeenCalledTimes(1);
    const xml = mockMakeSvg.mock.calls[0][0] as string;
    // The stroke keeps its color; the paper follows the theme surface, not fixed white.
    expect(xml).toContain('#e03131');
    expect(xml).toContain('#f4f4f4');
    // A 200x100 page letterboxes centered in the 48px square instead of distorting.
    expect(imageSvgProps()).toMatchObject({ x: 0, y: 12, width: 48, height: 24 });
    expect(screen.getByLabelText('Throne room')).toBeTruthy();
    expect(screen.queryByTestId('sketch-icon')).toBeNull();
  });

  it('repaints when the theme changes, with nothing stored anywhere', async () => {
    const rendered = await render(<SketchPreviewThumb sketch={sketchOf(drawn())} />);
    expect(mockMakeSvg).toHaveBeenCalledTimes(1);

    mockTheme.colors = { ...mockTheme.colors, surface: '#000000' };
    await rendered.rerender(<SketchPreviewThumb sketch={sketchOf(drawn())} />);

    expect(mockMakeSvg).toHaveBeenCalledTimes(2);
    expect(mockMakeSvg.mock.calls[1][0]).toContain('#000000');
    mockTheme.colors = { ...mockTheme.colors, surface: '#f4f4f4' };
  });

  it('shows the icon while the sketch is blank, without parsing anything', async () => {
    await render(<SketchPreviewThumb sketch={sketchOf(blank())} />);

    expect(mockMakeSvg).not.toHaveBeenCalled();
    expect(screen.getByTestId('sketch-icon')).toBeTruthy();
  });

  it('shows the icon when the stored content is corrupt', async () => {
    await render(
      <SketchPreviewThumb sketch={{ name: 'Throne room', content: { bogus: true } as never }} />,
    );

    expect(mockMakeSvg).not.toHaveBeenCalled();
    expect(screen.getByTestId('sketch-icon')).toBeTruthy();
  });

  it('hands the browser the same drawing as a data URI on web', async () => {
    (Platform as { OS: string }).OS = 'web';
    await render(<SketchPreviewThumb sketch={sketchOf(drawn())} />);

    // Skia's web SVG cannot paint synchronously, so the web never touches it.
    expect(mockMakeSvg).not.toHaveBeenCalled();
    const img = screen.getByLabelText('Throne room');
    const uri = (img.props as { source: { uri: string } }).source.uri;
    expect(uri.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(uri)).toContain('#e03131');
  });
});
