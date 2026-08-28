import type { LocationMapContentType } from '@keres/shared';
import React, { forwardRef, useMemo } from 'react';
import Svg, { Path, Polygon } from 'react-native-svg';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '@/src/hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '@/src/hooks/usePanZoomCanvas';
import { locationMapCanvasSize } from '../../../utils/locationMapLayout';
import LocationMapImageView from './LocationMapImageView';
import LocationMapNodeView from './LocationMapNodeView';

export type LocationMapCanvasHandle = PanZoomCanvasHandle;

export interface LocationMapConnection {
  locationAId: string;
  locationBId: string;
}

/** A `contains` relation: `parentLocationId` contains `childLocationId`. */
export interface LocationMapContains {
  parentLocationId: string;
  childLocationId: string;
}

interface Props {
  content: LocationMapContentType;
  /** Resolved URIs of the gallery media used as image bases, keyed by gallery id. */
  imageUris: Record<string, string | null>;
  /** Display names of the locations, keyed by location id. */
  nodeNames: Record<string, string>;
  /** Real `connected_to` relations between locations, drawn as lines. */
  connections: LocationMapConnection[];
  /** Real `contains` relations between locations, drawn as directional sawtooth arrows. */
  contains: LocationMapContains[];
  selectedImageId: string | null;
  selectedNodeId: string | null;
  onSelectImage: (imageId: string) => void;
  onMoveImage: (imageId: string, x: number, y: number) => void;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
}

const CONNECTED_COLOR = '#9E9E9E';
const CONTAINS_COLOR = '#8BC34A';
const SAWTOOTH_AMPLITUDE = 7;
const SAWTOOTH_SEGMENTS = 6;

/** A sawtooth (zigzag) path between two points - the visual of a `contains` relation. */
function sawtoothPath(ax: number, ay: number, bx: number, by: number): string {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  let d = `M ${ax} ${ay}`;
  for (let index = 1; index < SAWTOOTH_SEGMENTS; index += 1) {
    const t = index / SAWTOOTH_SEGMENTS;
    const side = index % 2 === 1 ? 1 : -1;
    d += ` L ${ax + dx * t + nx * SAWTOOTH_AMPLITUDE * side} ${ay + dy * t + ny * SAWTOOTH_AMPLITUDE * side}`;
  }
  return `${d} L ${bx} ${by}`;
}

/** A triangle marking the arrow's tip, pointing along `angle` (radians). */
function arrowHeadPoints(tipX: number, tipY: number, angle: number): string {
  const size = 10;
  return [
    [tipX, tipY],
    [tipX - size * Math.cos(angle - 0.4), tipY - size * Math.sin(angle - 0.4)],
    [tipX - size * Math.cos(angle + 0.4), tipY - size * Math.sin(angle + 0.4)],
  ]
    .map((pair) => pair.join(','))
    .join(' ');
}

const LocationMapCanvas = forwardRef<LocationMapCanvasHandle, Props>(
  (
    {
      content,
      imageUris,
      nodeNames,
      connections,
      contains,
      selectedImageId,
      selectedNodeId,
      onSelectImage,
      onMoveImage,
      onSelectNode,
      onMoveNode,
    },
    ref,
  ) => {
    const size = locationMapCanvasSize(content);
    const panZoom = usePanZoomCanvas(ref, size, { refitOnLayoutChange: false, freePan: true });
    const { setChildDragging, getTransform, ...frame } = panZoom;
    const scale = getTransform().scale;

    const byLocation = useMemo(() => {
      const map = new Map<string, { x: number; y: number }>();
      for (const node of content.nodes) {
        map.set(node.locationId, { x: node.x, y: node.y });
      }
      return map;
    }, [content.nodes]);

    const connectionPaths = useMemo(
      () =>
        connections
          .filter(
            (connection) =>
              byLocation.has(connection.locationAId) && byLocation.has(connection.locationBId),
          )
          .map((connection) => {
            const a = byLocation.get(connection.locationAId)!;
            const b = byLocation.get(connection.locationBId)!;
            return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
          }),
      [byLocation, connections],
    );

    const containsArrows = useMemo(
      () =>
        contains
          .filter(
            (relation) =>
              byLocation.has(relation.parentLocationId) && byLocation.has(relation.childLocationId),
          )
          .map((relation) => {
            const from = byLocation.get(relation.parentLocationId)!;
            const to = byLocation.get(relation.childLocationId)!;
            const angle = Math.atan2(to.y - from.y, to.x - from.x);
            return {
              path: sawtoothPath(from.x, from.y, to.x, to.y),
              arrow: arrowHeadPoints(to.x, to.y, angle),
            };
          }),
      [byLocation, contains],
    );

    return (
      <GraphCanvasFrame width={size.width} height={size.height} contentOverflow="visible" {...frame}>
        {content.images.map((image) => (
          <LocationMapImageView
            key={image.id}
            image={image}
            uri={imageUris[image.galleryId] ?? null}
            selected={selectedImageId === image.id}
            scale={scale}
            onSelect={() => onSelectImage(image.id)}
            onMove={(x, y) => onMoveImage(image.id, x, y)}
            onDragStart={() => setChildDragging(true)}
            onDragEnd={() => setChildDragging(false)}
          />
        ))}
        <Svg
          width={size.width}
          height={size.height}
          pointerEvents="none"
          style={{ overflow: 'visible', position: 'absolute', left: 0, top: 0 }}
        >
          {connectionPaths.map((path, index) => (
            <Path
              key={`connection-${index}`}
              d={path}
              fill="none"
              stroke={CONNECTED_COLOR}
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeOpacity={0.8}
            />
          ))}
          {containsArrows.map((arrow, index) => (
            <React.Fragment key={`contains-${index}`}>
              <Path
                d={arrow.path}
                fill="none"
                stroke={CONTAINS_COLOR}
                strokeWidth={2}
                strokeOpacity={0.9}
              />
              <Polygon points={arrow.arrow} fill={CONTAINS_COLOR} />
            </React.Fragment>
          ))}
        </Svg>
        {content.nodes.map((node) => (
          <LocationMapNodeView
            key={node.id}
            node={node}
            name={nodeNames[node.locationId] ?? node.locationId}
            selected={selectedNodeId === node.id}
            scale={scale}
            onSelect={() => onSelectNode(node.id)}
            onMove={(x, y) => onMoveNode(node.id, x, y)}
            onDragStart={() => setChildDragging(true)}
            onDragEnd={() => setChildDragging(false)}
          />
        ))}
      </GraphCanvasFrame>
    );
  },
);

LocationMapCanvas.displayName = 'LocationMapCanvas';

export default LocationMapCanvas;