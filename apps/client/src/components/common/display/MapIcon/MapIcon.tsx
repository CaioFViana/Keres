import { resolveMapIcon } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import { Canvas, ImageSVG, Skia } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { Image, Platform, View } from 'react-native';
import { buildKeresSvgMarkup, keresIconDataUri } from '../../../../utils/keresIconMarkup';
import { KERES_ICON_PATHS } from '../../../../utils/keresIconPaths';
import { mapIconGlyph } from '../../../../utils/mapIconGlyph';

/**
 * Keres glyphs fill their box edge to edge while Ionicons carry built-in padding;
 * drawing the pack slightly smaller matches the perceived weight, without shrinking
 * the detailed glyphs into illegibility.
 */
const KERES_VISUAL_SCALE = 0.9;

interface MapIconProps {
  /** Stored icon name: plain/`ion:` Ionicons, `keres:` pack. */
  name: string | null | undefined;
  size: number;
  color: string;
  testID?: string;
}

/** Native branch: Skia parses the tinted markup and draws it. */
const NativeKeresIcon: React.FC<MapIconProps & { shapes: string }> = ({
  name,
  shapes,
  size,
  color,
  testID,
}) => {
  const svg = useMemo(
    () => Skia.SVG.MakeFromString(buildKeresSvgMarkup(shapes, color)),
    [shapes, color],
  );
  if (!svg) {
    return <Ionicons testID={testID} name={mapIconGlyph(name)} size={size} color={color} />;
  }
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
};

/**
 * Web branch: Skia's web SVG is a hidden `<img>` decoded asynchronously while `drawSvg`
 * snapshots it synchronously (and ignores the requested size), so icons paint blank and
 * never recover. The browser decodes the same tinted markup directly instead, sized
 * identically.
 */
const WebKeresIcon: React.FC<Omit<MapIconProps, 'name'> & { shapes: string }> = ({
  shapes,
  size,
  color,
  testID,
}) => {
  const uri = useMemo(() => keresIconDataUri(shapes, color), [shapes, color]);
  const scaled = size * KERES_VISUAL_SCALE;
  return (
    <View
      testID={testID}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Image source={{ uri }} style={{ width: scaled, height: scaled }} />
    </View>
  );
};

/**
 * One map/avatar icon in its family's renderer: Ionicons font glyphs for the ion
 * family, a Skia SVG for the keres pack (Skia cannot render font glyphs, and the app
 * renders no react-native-svg). Unknown or missing artwork falls back to the
 * `location` glyph, like `mapIconGlyph`.
 */
const MapIcon: React.FC<MapIconProps> = ({ name, size, color, testID }) => {
  const resolved = resolveMapIcon(name ?? '');
  const shapes =
    resolved.family === 'keres' && resolved.glyph
      ? (KERES_ICON_PATHS[resolved.glyph] ?? null)
      : null;
  if (shapes) {
    if (Platform.OS === 'web') {
      return <WebKeresIcon shapes={shapes} size={size} color={color} testID={testID} />;
    }
    return (
      <NativeKeresIcon name={name} shapes={shapes} size={size} color={color} testID={testID} />
    );
  }
  return <Ionicons testID={testID} name={mapIconGlyph(name)} size={size} color={color} />;
};

export default MapIcon;
