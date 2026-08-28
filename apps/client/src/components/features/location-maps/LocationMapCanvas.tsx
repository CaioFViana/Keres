import type { LocationMapContentType } from '@keres/shared';
import React, { forwardRef, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '@/src/hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '@/src/hooks/usePanZoomCanvas';
import { useTheme } from '../../../theme';
import { locationMapCanvasSize } from '../../../utils/locationMapLayout';
import LocationMapImageView from './LocationMapImageView';
import LocationMapNodeView from './LocationMapNodeView';

export type LocationMapCanvasHandle = PanZoomCanvasHandle;

export interface LocationMapConnection {
  locationAId: string;
  locationBId: string;
}

interface Props {
  content: LocationMapContentType;
  /** Resolved URIs of the gallery media used as image bases, keyed by gallery id. */
  imageUris: Record<string, string | null>;
  /** Display names of the locations, keyed by location id. */
  nodeNames: Record<string, string>;
  /** Real `connected_to` relations between locations, drawn as lines. */
  connections: LocationMapConnection[];
  selectedImageId: string | null;
  selectedNodeId: string | null;
  onSelectImage: (imageId: string) => void;
  onMoveImage: (imageId: string, x: number, y: number) => void;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
}

const LocationMapCanvas = forwardRef<LocationMapCanvasHandle, Props>(
  (
    {
      content,
      imageUris,
      nodeNames,
      connections,
      selectedImageId,
      selectedNodeId,
      onSelectImage,
      onMoveImage,
      onSelectNode,
      onMoveNode,
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const size = locationMapCanvasSize(content);
    const panZoom = usePanZoomCanvas(ref, size, { refitOnLayoutChange: false, freePan: true });
    const { setChildDragging, getTransform, ...frame } = panZoom;
    const scale = getTransform().scale;

    const connectionPaths = useMemo(() => {
      const byLocation = new Map<string, { x: number; y: number }>();
      for (const node of content.nodes) {
        byLocation.set(node.locationId, { x: node.x, y: node.y });
      }
      return connections
        .filter(
          (connection) =>
            byLocation.has(connection.locationAId) && byLocation.has(connection.locationBId),
        )
        .map((connection) => {
          const a = byLocation.get(connection.locationAId)!;
          const b = byLocation.get(connection.locationBId)!;
          return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
        });
    }, [connections, content.nodes]);

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
              key={index}
              d={path}
              fill="none"
              stroke={colors.textSecondary}
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeOpacity={0.8}
            />
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