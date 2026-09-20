import { act, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { StatLadderBar } from '../../src/components/features/stats/StatLadderBar/StatLadderBar';
import { StatRadarChart } from '../../src/components/features/stats/StatRadarChart/StatRadarChart';
import type { StatRadarLayout } from '@keres/shared/graphs/statRadarLayout';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#dde',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

// The Skia drawings come from the global mock in `test/jest.setup.ts` (each drawing maps to a
// `Skia*` host placeholder); only the CanvasKit gate is driven per case.
const mockUseCanvasKitReady = jest.fn(() => true);
jest.mock('../../src/components/features/graphs/SkiaEdgeCanvas/useCanvasKitReady', () => ({
  useCanvasKitReady: (...args: unknown[]) =>
    (mockUseCanvasKitReady as (...inner: unknown[]) => boolean)(...args),
}));

beforeEach(() => {
  mockUseCanvasKitReady.mockReset();
  mockUseCanvasKitReady.mockReturnValue(true);
});

const ladder = [
  { label: 'F', minValue: 0 },
  { label: 'D', minValue: 20 },
  { label: 'C', minValue: 40 },
  { label: 'B', minValue: 60 },
  { label: 'A', minValue: 80 },
];

describe('StatLadderBar', () => {
  const measure = async (screen: Awaited<ReturnType<typeof render>>, width = 300) => {
    const containers = screen.container.queryAll(
      (node) => typeof node.props.onLayout === 'function',
    );
    expect(containers).toHaveLength(1);
    await act(async () => {
      containers[0].props.onLayout({ nativeEvent: { layout: { width } } });
    });
  };
  const skiaOf = (screen: Awaited<ReturnType<typeof render>>, type: string) =>
    screen.container.queryAll((node) => node.type === type);

  it('waits for its width before drawing anything', async () => {
    const screen = await render(<StatLadderBar ladder={ladder} value={50} />);

    expect(skiaOf(screen, 'SkiaCanvas')).toHaveLength(0);

    await measure(screen);
    expect(skiaOf(screen, 'SkiaCanvas')).toHaveLength(1);
  });

  it('waits for CanvasKit before drawing anything', async () => {
    mockUseCanvasKitReady.mockReturnValue(false);
    const screen = await render(<StatLadderBar ladder={ladder} value={50} />);
    await measure(screen);

    expect(skiaOf(screen, 'SkiaCanvas')).toHaveLength(0);
  });

  it('draws one band per rung plus a dashed overflow band', async () => {
    const screen = await render(<StatLadderBar ladder={ladder} value={50} />);
    await measure(screen);

    const fills = skiaOf(screen, 'SkiaRect').filter((rect) => rect.props.style !== 'stroke');
    expect(fills).toHaveLength(ladder.length);
    // Alternating bands keep the rungs from blurring into one bar.
    expect(fills[0].props.color).toBe('#eee');
    expect(fills[1].props.color).toBe('#dde');
    // The overflow band is an outline, dashed like the radar's outer ring.
    const outlines = skiaOf(screen, 'SkiaRect').filter((rect) => rect.props.style === 'stroke');
    const overflow = outlines.filter((rect) => rect.props.color === '#555');
    expect(overflow).toHaveLength(1);
    expect(overflow[0].props.strokeWidth).toBe(1);
    const [dash] = skiaOf(screen, 'SkiaDashPathEffect');
    expect(dash.props.intervals).toEqual([3, 3]);
    expect(dash.parent).toBe(overflow[0]);
  });

  it('marks the value with a line and a dot', async () => {
    const screen = await render(<StatLadderBar ladder={ladder} value={50} />);
    await measure(screen);

    const dots = skiaOf(screen, 'SkiaCircle');
    expect(dots).toHaveLength(1);
    expect(dots[0].props).toMatchObject({ r: 6, color: '#00f' });
    const valueLines = skiaOf(screen, 'SkiaLine').filter((line) => line.props.color === '#00f');
    expect(valueLines).toHaveLength(1);
  });

  it('grows the dot once the value leaves the registered scale', async () => {
    const screen = await render(<StatLadderBar ladder={ladder} value={5000} />);
    await measure(screen);

    expect(skiaOf(screen, 'SkiaCircle')[0].props.r).toBe(7.5);
  });

  it('draws no marker when there is no value', async () => {
    const screen = await render(<StatLadderBar ladder={ladder} value={null} />);
    await measure(screen);

    expect(skiaOf(screen, 'SkiaCanvas')).toHaveLength(1);
    expect(skiaOf(screen, 'SkiaCircle')).toHaveLength(0);
    expect(skiaOf(screen, 'SkiaLine').filter((line) => line.props.color === '#00f')).toHaveLength(
      0,
    );
  });

  it('labels the rungs that fit', async () => {
    const screen = await render(<StatLadderBar ladder={ladder} value={50} />);
    await measure(screen);

    const texts = skiaOf(screen, 'SkiaText').map((node) => node.props.text);
    // Both ends always go in: they say where the ladder starts and ends.
    expect(texts).toContain('F');
    expect(texts).toContain('A');
  });
});

describe('StatRadarChart', () => {
  const radarLayout = (): StatRadarLayout => ({
    size: 300,
    center: { x: 150, y: 150 },
    radius: 120,
    rings: [
      { radius: 100, label: 'C', points: '150,50 250,150 150,250 50,150', isOverflow: false },
      { radius: 120, label: 'S+', points: '150,30 270,150 150,270 30,150', isOverflow: true },
    ],
    axes: [
      {
        statId: 'st-1',
        label: 'Might',
        angle: 0,
        end: { x: 150, y: 50 },
        labelPoint: { x: 150, y: 40 },
        textAnchor: 'middle',
      },
    ],
    series: [
      {
        id: 'c-1',
        label: 'Alice',
        color: '#f00',
        points: '150,80 220,150 150,220 80,150',
        vertices: [
          { statId: 'st-1', x: 150, y: 80, value: 80, display: 'C (80)', isOverflow: false },
          { statId: 'st-2', x: 400, y: 150, value: 5000, display: 'S+ (5000)', isOverflow: true },
        ],
      },
    ],
  });
  const skiaOf = (screen: Awaited<ReturnType<typeof render>>, type: string) =>
    screen.container.queryAll((node) => node.type === type);

  it('explains itself when there are not enough axes', async () => {
    const screen = await render(<StatRadarChart layout={null} emptyMessage="Need more" />);

    expect(screen.getByText('Need more')).toBeTruthy();
    expect(skiaOf(screen, 'SkiaCanvas')).toHaveLength(0);
  });

  it('waits for CanvasKit before drawing anything', async () => {
    mockUseCanvasKitReady.mockReturnValue(false);
    const screen = await render(<StatRadarChart layout={radarLayout()} emptyMessage="Need more" />);

    expect(skiaOf(screen, 'SkiaCanvas')).toHaveLength(0);
  });

  it('paints rings, axes, series and their vertices', async () => {
    const screen = await render(<StatRadarChart layout={radarLayout()} emptyMessage="Need more" />);

    const [canvas] = skiaOf(screen, 'SkiaCanvas');
    expect(StyleSheet.flatten(canvas.props.style)).toMatchObject({ width: 300, height: 300 });

    const paths = skiaOf(screen, 'SkiaPath');
    // Each polygon crosses as a fill plus a stroke path; the dashed overshoot band has no fill.
    expect(paths).toHaveLength(5);
    const fills = paths.filter((path) => path.props.style !== 'stroke');
    expect(fills).toHaveLength(2);
    expect(fills[0].props).toMatchObject({ color: '#eee', opacity: 0.35 });
    expect(fills[1].props).toMatchObject({ color: '#f00', opacity: 0.22 });
    const [dash] = skiaOf(screen, 'SkiaDashPathEffect');
    expect(dash.props.intervals).toEqual([4, 4]);
    // The series stroke carries its own color.
    const seriesStrokes = paths.filter(
      (path) => path.props.style === 'stroke' && path.props.color === '#f00',
    );
    expect(seriesStrokes).toHaveLength(1);
    expect(seriesStrokes[0].props.strokeWidth).toBe(2);

    expect(skiaOf(screen, 'SkiaLine')).toHaveLength(1);
    const vertices = skiaOf(screen, 'SkiaCircle');
    expect(vertices).toHaveLength(2);
    expect(vertices[0].props).toMatchObject({ r: 3.5, color: '#f00' });
    expect(vertices[1].props.r).toBe(5);

    expect(skiaOf(screen, 'SkiaText').map((node) => node.props.text)).toContain('Might');
  });
});
