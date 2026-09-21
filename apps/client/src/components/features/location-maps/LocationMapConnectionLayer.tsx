import {
  clipSpatialSegment,
  spatialRectIntersects,
  type LocationMapContentType,
  type SpatialPoint,
  type SpatialRect,
} from '@keres/shared';
import { DashPathEffect, Path, Text as SkiaText } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';
import React, { useMemo, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type { CanvasCameraTransform } from '../../../hooks/useCanvasViewport';
import { interpolateColor, pointOnCircleBoundary } from '@keres/shared/graphs/locationMapGeometry';
import { LOCATION_MAP_NODE_SIZE } from '@keres/shared/graphs/locationMapLayout';
import SkiaEdgeCanvas from '../graphs/SkiaEdgeCanvas/SkiaEdgeCanvas';
import { measureEdgeLabelWidth } from '../graphs/SkiaEdgeCanvas/measureEdgeLabelWidth';
import { useEdgeFont } from '../graphs/SkiaEdgeCanvas/useEdgeFont';
import { polygonPointsToPath } from '../graphs/SkiaEdgeCanvas/polygonPointsToPath';

export interface LocationMapConnection {
  locationAId: string;
  locationBId: string;
  label?: string | null;
}

/** A `contains` relation: `parentLocationId` contains `childLocationId`. */
export interface LocationMapContains {
  parentLocationId: string;
  childLocationId: string;
  label?: string | null;
}

interface Props {
  content: LocationMapContentType;
  connections: LocationMapConnection[];
  contains: LocationMapContains[];
  connectionDrag: { fromNodeId: string; x: number; y: number } | null;
  /** Live camera from the viewport hook; the overlay tracks gestures with no React commit. */
  camera: SharedValue<CanvasCameraTransform>;
  renderWindow: SpatialRect;
  background: string;
  primary: string;
}

const NODE_RADIUS = LOCATION_MAP_NODE_SIZE / 2;
const LINE_END_MARGIN = 3;
const HALO_WIDTH = 6;

type WorldNode = LocationMapContentType['nodes'][number];
type ConnectionPath = {
  id: string;
  path: string;
  color: string;
  label?: string | null;
  x: number;
  y: number;
  start: SpatialPoint;
  end: SpatialPoint;
};
type ContainsArrow = ConnectionPath & { arrow: string; arrowHalo: string };
type MarkerConnectionPath = ConnectionPath & {
  directed: boolean;
  arrow?: string;
  arrowHalo?: string;
};

const ConnectionPathView = React.memo(function ConnectionPathView({
  path,
  background,
  font,
}: {
  path: ConnectionPath;
  background: string;
  font: SkFont | null;
}) {
  return (
    <>
      <Path
        path={path.path}
        style="stroke"
        color={background}
        strokeWidth={HALO_WIDTH}
        opacity={0.9}
      />
      <Path path={path.path} style="stroke" color={path.color} strokeWidth={2} opacity={0.85} />
      <RelationLabel relation={path} background={background} font={font} />
    </>
  );
});

const ContainsArrowView = React.memo(function ContainsArrowView({
  arrow,
  background,
  font,
}: {
  arrow: ContainsArrow;
  background: string;
  font: SkFont | null;
}) {
  return (
    <>
      <Path
        path={arrow.path}
        style="stroke"
        color={background}
        strokeWidth={HALO_WIDTH}
        opacity={0.9}
      />
      <Path path={arrow.path} style="stroke" color={arrow.color} strokeWidth={2} opacity={0.85}>
        <DashPathEffect intervals={[6, 4]} />
      </Path>
      <Path path={polygonPointsToPath(arrow.arrowHalo)} color={background} />
      <Path path={polygonPointsToPath(arrow.arrow)} color={arrow.color} />
      <RelationLabel relation={arrow} background={background} font={font} />
    </>
  );
});

const MarkerConnectionView = React.memo(function MarkerConnectionView({
  connection,
  background,
  font,
}: {
  connection: MarkerConnectionPath;
  background: string;
  font: SkFont | null;
}) {
  return (
    <>
      <Path path={connection.path} style="stroke" color={background} strokeWidth={HALO_WIDTH} />
      <Path
        path={connection.path}
        style="stroke"
        color={connection.color}
        strokeWidth={connection.directed ? 2 : 1.6}
      />
      {connection.directed && connection.arrow && connection.arrowHalo && (
        <>
          <Path path={polygonPointsToPath(connection.arrowHalo)} color={background} />
          <Path path={polygonPointsToPath(connection.arrow)} color={connection.color} />
        </>
      )}
      <RelationLabel relation={connection} background={background} font={font} />
    </>
  );
});

function RelationLabel({
  relation,
  background,
  font,
}: {
  relation: ConnectionPath;
  background: string;
  font: SkFont | null;
}) {
  // Without a font (web: `matchFamilyStyle` is unimplemented) the edge still draws,
  // only its label is skipped.
  if (!relation.label || !font) return null;
  // Skia has no `textAnchor`: center by measured width instead. Both place the baseline at
  // the same y.
  const x = relation.x - measureEdgeLabelWidth(font, relation.label, 11) / 2;
  return (
    <>
      <SkiaText
        x={x}
        y={relation.y - 6}
        font={font}
        text={relation.label}
        color={background}
        style="stroke"
        strokeWidth={4}
      />
      <SkiaText x={x} y={relation.y - 6} font={font} text={relation.label} color={relation.color} />
    </>
  );
}

function arrowHeadPoints(tipX: number, tipY: number, angle: number, size: number): string {
  return [
    [tipX, tipY],
    [tipX - size * Math.cos(angle - 0.4), tipY - size * Math.sin(angle - 0.4)],
    [tipX - size * Math.cos(angle + 0.4), tipY - size * Math.sin(angle + 0.4)],
  ]
    .map((pair) => pair.join(','))
    .join(' ');
}

const LocationMapConnectionLayer: React.FC<Props> = ({
  content,
  connections,
  contains,
  connectionDrag,
  camera,
  renderWindow,
  background,
  primary,
}) => {
  // System font on native, bundled Roboto on web; null while unavailable, where labels
  // are skipped.
  const edgeFont = useEdgeFont(11);
  const [connectionCache] = useState(
    () =>
      new Map<
        string,
        { relation: LocationMapConnection; from: WorldNode; to: WorldNode; path: ConnectionPath }
      >(),
  );
  const [containsCache] = useState(
    () =>
      new Map<
        string,
        { relation: LocationMapContains; from: WorldNode; to: WorldNode; arrow: ContainsArrow }
      >(),
  );
  const nodesByLocation = useMemo(
    () => new Map(content.nodes.map((node) => [node.locationId, node])),
    [content.nodes],
  );
  const connectionPaths = useMemo(() => {
    const activeIds = new Set<string>();
    const paths = connections.flatMap((connection) => {
      const from = nodesByLocation.get(connection.locationAId);
      const to = nodesByLocation.get(connection.locationBId);
      if (!from || !to) return [];
      const id = `${connection.locationAId}-${connection.locationBId}`;
      activeIds.add(id);
      const cached = connectionCache.get(id);
      if (cached?.relation === connection && cached.from === from && cached.to === to)
        return [cached.path];
      const start = pointOnCircleBoundary(from, to, NODE_RADIUS + LINE_END_MARGIN);
      const end = pointOnCircleBoundary(to, from, NODE_RADIUS + LINE_END_MARGIN);
      const path = {
        id,
        path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
        color: interpolateColor(from.color, to.color),
        label: connection.label,
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2,
        start,
        end,
      };
      connectionCache.set(id, { relation: connection, from, to, path });
      return [path];
    });
    for (const id of connectionCache.keys())
      if (!activeIds.has(id)) connectionCache.delete(id);
    return paths;
  }, [connectionCache, connections, nodesByLocation]);
  const containsArrows = useMemo(() => {
    const activeIds = new Set<string>();
    const arrows = contains.flatMap((relation) => {
      const from = nodesByLocation.get(relation.parentLocationId);
      const to = nodesByLocation.get(relation.childLocationId);
      if (!from || !to) return [];
      const id = `${relation.parentLocationId}-${relation.childLocationId}`;
      activeIds.add(id);
      const cached = containsCache.get(id);
      if (cached?.relation === relation && cached.from === from && cached.to === to)
        return [cached.arrow];
      const start = pointOnCircleBoundary(from, to, NODE_RADIUS + LINE_END_MARGIN);
      const tip = pointOnCircleBoundary(to, from, NODE_RADIUS + LINE_END_MARGIN);
      const angle = Math.atan2(tip.y - start.y, tip.x - start.x);
      const arrow = {
        id,
        path: `M ${start.x} ${start.y} L ${tip.x} ${tip.y}`,
        arrow: arrowHeadPoints(tip.x, tip.y, angle, 10),
        arrowHalo: arrowHeadPoints(tip.x, tip.y, angle, 13),
        color: interpolateColor(from.color, to.color),
        label: relation.label,
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2,
        start,
        end: tip,
      };
      containsCache.set(id, { relation, from, to, arrow });
      return [arrow];
    });
    for (const id of containsCache.keys())
      if (!activeIds.has(id)) containsCache.delete(id);
    return arrows;
  }, [containsCache, contains, nodesByLocation]);
  const markerConnectionPaths = useMemo(() => {
    const points = new Map(
      [...content.nodes, ...(content.markers ?? [])].map((point) => [point.id, point]),
    );
    return (content.markerConnections ?? []).flatMap((connection) => {
      const from = points.get(connection.fromId);
      const to = points.get(connection.toId);
      if (!from || !to) return [];
      const start = pointOnCircleBoundary(from, to, NODE_RADIUS + LINE_END_MARGIN);
      const end = pointOnCircleBoundary(to, from, NODE_RADIUS + LINE_END_MARGIN);
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      return [
        {
          id: connection.id,
          path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
          color: interpolateColor(from.color, to.color),
          directed: connection.directed,
          arrow: connection.directed ? arrowHeadPoints(end.x, end.y, angle, 10) : undefined,
          arrowHalo: connection.directed ? arrowHeadPoints(end.x, end.y, angle, 13) : undefined,
          label: connection.label,
          x: (from.x + to.x) / 2,
          y: (from.y + to.y) / 2,
          start,
          end,
        },
      ];
    });
  }, [content.markers, content.markerConnections, content.nodes]);
  const connectionPath = useMemo(() => {
    if (!connectionDrag) return null;
    const source = [...content.nodes, ...(content.markers ?? [])].find(
      (point) => point.id === connectionDrag.fromNodeId,
    );
    const segment = source
      ? clipSpatialSegment(source, { x: connectionDrag.x, y: connectionDrag.y }, renderWindow)
      : null;
    return segment
      ? `M ${segment.from.x} ${segment.from.y} L ${segment.to.x} ${segment.to.y}`
      : null;
  }, [connectionDrag, content.markers, content.nodes, renderWindow]);
  const visibleConnections = useMemo(
    () => connectionPaths.flatMap((path) => clippedPath(path, renderWindow)),
    [connectionPaths, renderWindow],
  );
  const visibleContains = useMemo(
    () =>
      containsArrows.flatMap((arrow) => {
        const [path] = clippedPath(arrow, renderWindow);
        if (!path) return [];
        const angle = Math.atan2(path.end.y - path.start.y, path.end.x - path.start.x);
        return [
          {
            ...path,
            arrow: arrowHeadPoints(path.end.x, path.end.y, angle, 10),
            arrowHalo: arrowHeadPoints(path.end.x, path.end.y, angle, 13),
          },
        ];
      }),
    [containsArrows, renderWindow],
  );
  const visibleMarkerConnections = useMemo(
    () =>
      markerConnectionPaths.flatMap((connection) => {
        const [path] = clippedPath(connection, renderWindow);
        if (!path) return [];
        const angle = Math.atan2(path.end.y - path.start.y, path.end.x - path.start.x);
        return [
          {
            ...path,
            ...(connection.directed
              ? {
                  arrow: arrowHeadPoints(path.end.x, path.end.y, angle, 10),
                  arrowHalo: arrowHeadPoints(path.end.x, path.end.y, angle, 13),
                }
              : {}),
          },
        ];
      }),
    [markerConnectionPaths, renderWindow],
  );

  return (
    <SkiaEdgeCanvas camera={camera}>
      {visibleConnections.map((connection) => (
        <ConnectionPathView
          key={connection.id}
          path={connection}
          background={background}
          font={edgeFont}
        />
      ))}
      {visibleContains.map((arrow) => (
        <ContainsArrowView key={arrow.id} arrow={arrow} background={background} font={edgeFont} />
      ))}
      {connectionPath && (
        <Path path={connectionPath} style="stroke" color={primary} strokeWidth={2}>
          <DashPathEffect intervals={[6, 4]} />
        </Path>
      )}
      {visibleMarkerConnections.map((connection) => (
        <MarkerConnectionView
          key={connection.id}
          connection={connection}
          background={background}
          font={edgeFont}
        />
      ))}
    </SkiaEdgeCanvas>
  );
};

export default LocationMapConnectionLayer;

function clippedPath<T extends ConnectionPath>(path: T, window: SpatialRect): T[] {
  const segment = clipSpatialSegment(path.start, path.end, window);
  if (!segment) return [];
  const labelVisible = spatialRectIntersects({ x: path.x, y: path.y, width: 1, height: 1 }, window);
  return [
    {
      ...path,
      path: `M ${segment.from.x} ${segment.from.y} L ${segment.to.x} ${segment.to.y}`,
      start: segment.from,
      end: segment.to,
      label: labelVisible ? path.label : null,
    },
  ];
}
