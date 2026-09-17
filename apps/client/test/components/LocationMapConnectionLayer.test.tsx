import { render, type RenderResult } from '@testing-library/react-native';
import type { LocationMapContentType } from '@keres/shared';
import { clipSpatialSegment } from '@keres/shared';
import { pointOnCircleBoundary } from '@keres/shared/graphs/locationMapGeometry';
import { LOCATION_MAP_NODE_SIZE } from '@keres/shared/graphs/locationMapLayout';
import React from 'react';
import { StyleSheet } from 'react-native';
import LocationMapConnectionLayer from '../../src/components/features/location-maps/LocationMapConnectionLayer';

type Root = RenderResult['container'];

const NODES = [
  { id: 'n1', locationId: 'loc-a', x: 100, y: 100, icon: 'flag', color: '#ff0000' },
  { id: 'n2', locationId: 'loc-b', x: 500, y: 300, icon: 'flag', color: '#0000ff' },
  { id: 'n3', locationId: 'loc-c', x: 500, y: 500, icon: 'flag', color: '#00ff00' },
  { id: 'n4', locationId: 'loc-far', x: 5000, y: 5000, icon: 'flag', color: '#00ff00' },
  { id: 'n5', locationId: 'loc-farther', x: 6000, y: 5000, icon: 'flag', color: '#00ff00' },
] as const;
const CONTENT = { images: [], nodes: [...NODES] } as unknown as LocationMapContentType;
const WINDOW = { x: -50, y: -80, width: 1000, height: 800 };

const MARGIN = LOCATION_MAP_NODE_SIZE / 2 + 3;

function boundary(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  return pointOnCircleBoundary(from, to, MARGIN);
}

function expectedLine(from: (typeof NODES)[number], to: (typeof NODES)[number]): string {
  const start = boundary(from, to);
  const end = boundary(to, from);
  const segment = clipSpatialSegment(start, end, WINDOW);
  if (!segment) throw new Error('expected a visible segment');
  return `M ${segment.from.x} ${segment.from.y} L ${segment.to.x} ${segment.to.y}`;
}

/** Connection lines only: an arrowhead's path never contains a line-to. */
function linePathsOf(root: Root) {
  return root
    .queryAll((node) => node.type === 'RNSVGPath')
    .map((candidate) => candidate.props.d as string)
    .filter((d) => d.includes(' L '));
}

function labelTextsOf(root: Root) {
  return root
    .queryAll((node) => node.type === 'RNSVGTSpan')
    .map((candidate) => candidate.props.content as string);
}

async function renderLayer(extra: Record<string, unknown> = {}) {
  const view = await render(
    <LocationMapConnectionLayer
      content={CONTENT}
      connections={[{ locationAId: 'loc-a', locationBId: 'loc-b', label: 'trail' }]}
      contains={[{ parentLocationId: 'loc-a', childLocationId: 'loc-c', label: null }]}
      connectionDrag={null}
      originX={WINDOW.x}
      originY={WINDOW.y}
      renderWindow={WINDOW}
      background="#000"
      primary="#fff"
      {...extra}
    />,
  );
  return view.container;
}

describe('location map connection layer', () => {
  it('sizes the overlay in world units from the render window', async () => {
    const root = await renderLayer();
    const [svg] = root.queryAll((node) => node.type === 'RNSVGSvgView');

    expect(svg.props.width).toBe(WINDOW.width);
    expect(svg.props.height).toBe(WINDOW.height);
    expect(StyleSheet.flatten(svg.props.style)).toMatchObject({
      position: 'absolute',
      left: WINDOW.x,
      top: WINDOW.y,
    });
    // The inner group compensates the overlay origin, so world paths land back on the drawing.
    const [group] = root.queryAll((node) => node.type === 'RNSVGGroup' && node.props.matrix);
    expect(group.props.matrix[4]).toBe(-WINDOW.x);
    expect(group.props.matrix[5]).toBe(-WINDOW.y);
  });

  it('draws connections and contains arrows at their world positions', async () => {
    const root = await renderLayer();

    const drawn = linePathsOf(root);
    // Each relation paints a halo plus the line itself.
    expect(drawn).toHaveLength(4);
    expect(drawn).toContain(expectedLine(NODES[0], NODES[1]));
    expect(drawn).toContain(expectedLine(NODES[0], NODES[2]));

    // The contains arrowhead sits on the clipped tip, pointing along the line.
    const arrows = root
      .queryAll((node) => node.type === 'RNSVGPath')
      .map((candidate) => candidate.props.d as string)
      .filter((d) => !d.includes(' L '));
    expect(arrows.length).toBeGreaterThan(0);
    const tip = boundary(NODES[2], NODES[0]);
    const [tipX, tipY] = arrows[0].slice(1).split(' ').slice(0, 2).map(Number);
    // Recomputed from the clipped tip, so it agrees with the geometry up to float noise.
    expect(tipX).toBeCloseTo(tip.x, 8);
    expect(tipY).toBeCloseTo(tip.y, 8);
  });

  it('renders the visible label and clips a connection that leaves the window', async () => {
    const root = await renderLayer({
      connections: [
        { locationAId: 'loc-a', locationBId: 'loc-b', label: 'trail' },
        { locationAId: 'loc-a', locationBId: 'loc-far', label: 'outbound' },
      ],
    });

    const labels = labelTextsOf(root);
    expect(labels).toContain('trail');
    // The outbound midpoint leaves the window with the far endpoint, so its label is dropped.
    expect(labels).not.toContain('outbound');

    const drawn = linePathsOf(root);
    expect(drawn).toContain(expectedLine(NODES[0], NODES[3]));
  });

  it('culls a connection that never reaches the render window', async () => {
    const root = await renderLayer({
      connections: [{ locationAId: 'loc-far', locationBId: 'loc-farther', label: 'far' }],
      contains: [],
    });

    expect(linePathsOf(root)).toHaveLength(0);
    expect(labelTextsOf(root)).not.toContain('far');
  });
});
