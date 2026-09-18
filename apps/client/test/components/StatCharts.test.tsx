import { act, render } from '@testing-library/react-native';
import React from 'react';
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

// Vector primitives have no host tree in Jest; each one maps to a host
// placeholder that keeps its props queryable, like the Skia setup does.
jest.mock('react-native-svg', () => {
  const ReactActual = require('react');
  const { Text, View: RNView } = jest.requireActual('react-native');
  const host = (testID: string, renderText = false) =>
    function SvgStub(props: Record<string, any>) {
      const { children, ...rest } = props;
      return renderText
        ? ReactActual.createElement(Text, { testID, ...rest }, children)
        : ReactActual.createElement(RNView, { testID, ...rest }, children);
    };
  return {
    __esModule: true,
    default: host('svg-root'),
    Circle: host('svg-circle'),
    Line: host('svg-line'),
    Rect: host('svg-rect'),
    Polygon: host('svg-polygon'),
    Text: host('svg-text', true),
  };
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

  it('waits for its width before drawing anything', async () => {
    const screen = await render(<StatLadderBar ladder={ladder} value={50} />);

    expect(screen.queryByTestId('svg-root')).toBeNull();

    await measure(screen);
    expect(screen.getByTestId('svg-root')).toBeTruthy();
  });

  it('draws one band per rung plus a dashed overflow band', async () => {
    const screen = await render(<StatLadderBar ladder={ladder} value={50} />);
    await measure(screen);

    const rects = screen.getAllByTestId('svg-rect');
    expect(rects).toHaveLength(ladder.length + 1);
    // Alternating bands keep the rungs from blurring into one bar.
    expect(rects[0].props.fill).toBe('#eee');
    expect(rects[1].props.fill).toBe('#dde');
    // The overflow band is an outline, dashed like the radar's outer ring.
    expect(rects[rects.length - 1].props).toMatchObject({
      fill: 'none',
      strokeDasharray: '3 3',
    });
  });

  it('marks the value with a line and a dot', async () => {
    const screen = await render(<StatLadderBar ladder={ladder} value={50} />);
    await measure(screen);

    const dots = screen.getAllByTestId('svg-circle');
    expect(dots).toHaveLength(1);
    expect(dots[0].props).toMatchObject({ r: 6, fill: '#00f' });
    const valueLines = screen
      .getAllByTestId('svg-line')
      .filter((line) => line.props.stroke === '#00f');
    expect(valueLines).toHaveLength(1);
  });

  it('grows the dot once the value leaves the registered scale', async () => {
    const screen = await render(<StatLadderBar ladder={ladder} value={5000} />);
    await measure(screen);

    expect(screen.getByTestId('svg-circle').props.r).toBe(7.5);
  });

  it('draws no marker when there is no value', async () => {
    const screen = await render(<StatLadderBar ladder={ladder} value={null} />);
    await measure(screen);

    expect(screen.getByTestId('svg-root')).toBeTruthy();
    expect(screen.queryAllByTestId('svg-circle')).toHaveLength(0);
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

  it('explains itself when there are not enough axes', async () => {
    const screen = await render(<StatRadarChart layout={null} emptyMessage="Need more" />);

    expect(screen.getByText('Need more')).toBeTruthy();
    expect(screen.queryByTestId('svg-root')).toBeNull();
  });

  it('paints rings, axes, series and their vertices', async () => {
    const screen = await render(<StatRadarChart layout={radarLayout()} emptyMessage="Need more" />);

    const polygons = screen.getAllByTestId('svg-polygon');
    expect(polygons).toHaveLength(3);
    // The solid rings wash the surface; the overshoot band stays empty and dashed.
    expect(polygons[0].props.fill).toBe('#eee');
    expect(polygons[0].props.strokeDasharray).toBeUndefined();
    expect(polygons[1].props).toMatchObject({ fill: 'none', strokeDasharray: '4 4' });
    // The series polygon carries its own color.
    expect(polygons[2].props).toMatchObject({ fill: '#f00', stroke: '#f00' });

    expect(screen.getAllByTestId('svg-line')).toHaveLength(1);
    const vertices = screen.getAllByTestId('svg-circle');
    expect(vertices).toHaveLength(2);
    expect(vertices[0].props).toMatchObject({ r: 3.5, fill: '#f00' });
    expect(vertices[1].props.r).toBe(5);

    expect(screen.getByText('Might')).toBeTruthy();
  });
});
