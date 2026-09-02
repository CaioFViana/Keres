import type { LocationMapContentType } from '@keres/shared';
import React, { useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { G, Path, Polygon, Text as SvgText } from 'react-native-svg';
import { interpolateColor, pointOnCircleBoundary } from '@keres/shared/graphs/locationMapGeometry';
import { LOCATION_MAP_NODE_SIZE } from '@keres/shared/graphs/locationMapLayout';

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
  width: number;
  height: number;
  content: LocationMapContentType;
  connections: LocationMapConnection[];
  contains: LocationMapContains[];
  connectionDrag: { fromNodeId: string; x: number; y: number } | null;
  originX: number;
  originY: number;
  background: string;
  primary: string;
}

const NODE_RADIUS = LOCATION_MAP_NODE_SIZE / 2;
const LINE_END_MARGIN = 3;
const CONTAINS_DASH = '6 4';
const HALO_WIDTH = 6;

type WorldNode = LocationMapContentType['nodes'][number];
type ConnectionPath = {
  id: string;
  path: string;
  color: string;
  label?: string | null;
  x: number;
  y: number;
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
}: {
  path: ConnectionPath;
  background: string;
}) {
  return (
    <>
      <Path
        d={path.path}
        fill="none"
        stroke={background}
        strokeWidth={HALO_WIDTH}
        strokeOpacity={0.9}
      />
      <Path d={path.path} fill="none" stroke={path.color} strokeWidth={2} strokeOpacity={0.85} />
      <RelationLabel relation={path} background={background} />
    </>
  );
});

const ContainsArrowView = React.memo(function ContainsArrowView({
  arrow,
  background,
}: {
  arrow: ContainsArrow;
  background: string;
}) {
  return (
    <>
      <Path
        d={arrow.path}
        fill="none"
        stroke={background}
        strokeWidth={HALO_WIDTH}
        strokeOpacity={0.9}
      />
      <Path
        d={arrow.path}
        fill="none"
        stroke={arrow.color}
        strokeWidth={2}
        strokeDasharray={CONTAINS_DASH}
        strokeOpacity={0.85}
      />
      <Polygon points={arrow.arrowHalo} fill={background} />
      <Polygon points={arrow.arrow} fill={arrow.color} />
      <RelationLabel relation={arrow} background={background} />
    </>
  );
});

const MarkerConnectionView = React.memo(function MarkerConnectionView({
  connection,
  background,
}: {
  connection: MarkerConnectionPath;
  background: string;
}) {
  return (
    <>
      <Path d={connection.path} fill="none" stroke={background} strokeWidth={HALO_WIDTH} />
      <Path
        d={connection.path}
        fill="none"
        stroke={connection.color}
        strokeWidth={connection.directed ? 2 : 1.6}
      />
      {connection.directed && connection.arrow && connection.arrowHalo && (
        <>
          <Polygon points={connection.arrowHalo} fill={background} />
          <Polygon points={connection.arrow} fill={connection.color} />
        </>
      )}
      <RelationLabel relation={connection} background={background} />
    </>
  );
});

function RelationLabel({ relation, background }: { relation: ConnectionPath; background: string }) {
  if (!relation.label) return null;
  return (
    <>
      <SvgText
        x={relation.x}
        y={relation.y - 6}
        fill={background}
        stroke={background}
        strokeWidth={4}
        fontSize={11}
        textAnchor="middle"
      >
        {relation.label}
      </SvgText>
      <SvgText
        x={relation.x}
        y={relation.y - 6}
        fill={relation.color}
        fontSize={11}
        textAnchor="middle"
      >
        {relation.label}
      </SvgText>
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
  width,
  height,
  content,
  connections,
  contains,
  connectionDrag,
  originX,
  originY,
  background,
  primary,
}) => {
  const connectionCacheRef = useRef(
    new Map<
      string,
      { relation: LocationMapConnection; from: WorldNode; to: WorldNode; path: ConnectionPath }
    >(),
  );
  const containsCacheRef = useRef(
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
      const cached = connectionCacheRef.current.get(id);
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
      };
      connectionCacheRef.current.set(id, { relation: connection, from, to, path });
      return [path];
    });
    for (const id of connectionCacheRef.current.keys())
      if (!activeIds.has(id)) connectionCacheRef.current.delete(id);
    return paths;
  }, [connections, nodesByLocation]);
  const containsArrows = useMemo(() => {
    const activeIds = new Set<string>();
    const arrows = contains.flatMap((relation) => {
      const from = nodesByLocation.get(relation.parentLocationId);
      const to = nodesByLocation.get(relation.childLocationId);
      if (!from || !to) return [];
      const id = `${relation.parentLocationId}-${relation.childLocationId}`;
      activeIds.add(id);
      const cached = containsCacheRef.current.get(id);
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
      };
      containsCacheRef.current.set(id, { relation, from, to, arrow });
      return [arrow];
    });
    for (const id of containsCacheRef.current.keys())
      if (!activeIds.has(id)) containsCacheRef.current.delete(id);
    return arrows;
  }, [contains, nodesByLocation]);
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
        },
      ];
    });
  }, [content.markers, content.markerConnections, content.nodes]);
  const connectionPath = useMemo(() => {
    if (!connectionDrag) return null;
    const source = [...content.nodes, ...(content.markers ?? [])].find(
      (point) => point.id === connectionDrag.fromNodeId,
    );
    return source ? `M ${source.x} ${source.y} L ${connectionDrag.x} ${connectionDrag.y}` : null;
  }, [connectionDrag, content.markers, content.nodes]);

  return (
    <Svg width={width} height={height} pointerEvents="none" style={[styles.canvas, { zIndex: 1 }]}>
      <G transform={`translate(${-originX} ${-originY})`}>
        {connectionPaths.map((connection) => (
          <ConnectionPathView key={connection.id} path={connection} background={background} />
        ))}
        {containsArrows.map((arrow) => (
          <ContainsArrowView key={arrow.id} arrow={arrow} background={background} />
        ))}
        {connectionPath && (
          <Path
            d={connectionPath}
            fill="none"
            stroke={primary}
            strokeDasharray="6 4"
            strokeWidth={2}
          />
        )}
        {markerConnectionPaths.map((connection) => (
          <MarkerConnectionView
            key={connection.id}
            connection={connection}
            background={background}
          />
        ))}
      </G>
    </Svg>
  );
};

const styles = StyleSheet.create({
  canvas: { overflow: 'visible', position: 'absolute', left: 0, top: 0 },
});

export default LocationMapConnectionLayer;
