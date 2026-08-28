import type { LocationMapContentType } from '@keres/shared';
import React, { forwardRef, useMemo } from 'react';
import Svg, { Path, Polygon } from 'react-native-svg';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '@/src/hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '@/src/hooks/usePanZoomCanvas';
import { interpolateColor, pointOnCircleBoundary } from '../../../utils/locationMapColors';
import { locationMapCanvasSize, LOCATION_MAP_NODE_SIZE } from '../../../utils/locationMapLayout';
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
  /** Real `connected_to` relations between locations, drawn as solid lines. */
  connections: LocationMapConnection[];
  /** Real `contains` relations between locations, drawn as dashed directional arrows. */
  contains: LocationMapContains[];
  selectedImageId: string | null;
  selectedNodeId: string | null;
  onSelectImage: (imageId: string) => void;
  onMoveImage: (imageId: string, x: number, y: number) => void;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
}

const NODE_RADIUS = LOCATION_MAP_NODE_SIZE / 2;
/** How far the line's tip stays from the node's border - the arrow must not be buried under it. */
const LINE_END_MARGIN = 3;
const CONTAINS_DASH = '6 4';

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
      const map = new Map<string, { x: number; y: number; color: string }>();
      for (const node of content.nodes) {
        map.set(node.locationId, { x: node.x, y: node.y, color: node.color });
      }
      return map;
    }, [content.nodes]);

    // `connected_to` is a solid line between the two nodes' borders, coloured halfway between the
    // two nodes' colours.
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
            const start = pointOnCircleBoundary(a, b, NODE_RADIUS + LINE_END_MARGIN);
            const end = pointOnCircleBoundary(b, a, NODE_RADIUS + LINE_END_MARGIN);
            return {
              id: `${connection.locationAId}-${connection.locationBId}`,
              path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
              color: interpolateColor(a.color, b.color),
            };
          }),
      [byLocation, connections],
    );

    // `contains` is a dashed arrow from the parent's border to the child's border, so the tip is
    // visible instead of hidden under the target node.
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
            const start = pointOnCircleBoundary(from, to, NODE_RADIUS + LINE_END_MARGIN);
            const tip = pointOnCircleBoundary(to, from, NODE_RADIUS + LINE_END_MARGIN);
            const angle = Math.atan2(tip.y - start.y, tip.x - start.x);
            return {
              id: `${relation.parentLocationId}-${relation.childLocationId}`,
              path: `M ${start.x} ${start.y} L ${tip.x} ${tip.y}`,
              arrow: arrowHeadPoints(tip.x, tip.y, angle),
              color: interpolateColor(from.color, to.color),
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
            locked={image.locked}
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
          {connectionPaths.map((connection) => (
            <Path
              key={connection.id}
              d={connection.path}
              fill="none"
              stroke={connection.color}
              strokeWidth={2}
              strokeOpacity={0.85}
            />
          ))}
          {containsArrows.map((arrow) => (
            <React.Fragment key={arrow.id}>
              <Path
                d={arrow.path}
                fill="none"
                stroke={arrow.color}
                strokeWidth={2}
                strokeDasharray={CONTAINS_DASH}
                strokeOpacity={0.85}
              />
              <Polygon points={arrow.arrow} fill={arrow.color} />
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