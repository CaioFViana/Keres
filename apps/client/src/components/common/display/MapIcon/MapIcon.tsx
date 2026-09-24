import { resolveMapIcon } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import { Canvas, ImageSVG, Skia } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { KERES_ICON_PATHS } from '../../../../utils/keresIconPaths';
import { mapIconGlyph } from '../../../../utils/mapIconGlyph';
import { tintIconShapes } from '../../../../utils/mapIconSvg';

/**
 * Keres glyphs fill their box edge to edge while Ionicons carry built-in padding;
 * drawing the pack slightly smaller matches the perceived weight.
 */
const KERES_VISUAL_SCALE = 0.8;

interface MapIconProps {
  /** Stored icon name: plain/`ion:` Ionicons, `keres:` pack. */
  name: string | null | undefined;
  size: number;
  color: string;
  testID?: string;
}

/**
 * One map/avatar icon in its family's renderer: Ionicons font glyphs for the ion
 * family, a Skia SVG for the keres pack (Skia cannot render font glyphs, and the app
 * renders no react-native-svg). Unknown or missing artwork falls back to the
 * `location` glyph, like `mapIconGlyph`.
 */
const MapIcon: React.FC<MapIconProps> = ({ name, size, color, testID }) => {
  const resolved = resolveMapIcon(name ?? '');
  const svg = useMemo(() => {
    if (resolved.family !== 'keres' || !resolved.glyph) return null;
    const shapes = KERES_ICON_PATHS[resolved.glyph];
    if (!shapes) return null;
    return Skia.SVG.MakeFromString(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${tintIconShapes(shapes, color)}</svg>`,
    );
  }, [resolved.family, resolved.glyph, color]);
  if (resolved.family === 'keres' && resolved.glyph && svg) {
    const scaled = size * KERES_VISUAL_SCALE;
    return (
      <View
        testID={testID}
        style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      >
        <Canvas style={{ width: scaled, height: scaled }}>
          <ImageSVG svg={svg} x={0} y={0} width={scaled} height={scaled} />
        </Canvas>
      </View>
    );
  }
  return <Ionicons testID={testID} name={mapIconGlyph(name)} size={size} color={color} />;
};

export default MapIcon;
