import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';

interface SketchSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Display text next to the label (e.g. "12" or "60%"). */
  valueText: string;
  /** Maps the thumb position non-linearly so small sizes keep fine control. */
  curve?: 'linear' | 'quadratic';
  testID?: string;
}

const THUMB = 22;
const HEIGHT = 32;

function toRatio(value: number, min: number, max: number, curve: 'linear' | 'quadratic'): number {
  const linear = (value - min) / (max - min || 1);
  const clamped = Math.min(1, Math.max(0, linear));
  return curve === 'quadratic' ? Math.sqrt(clamped) : clamped;
}

function fromRatio(ratio: number, min: number, max: number, curve: 'linear' | 'quadratic'): number {
  const clamped = Math.min(1, Math.max(0, ratio));
  const linear = curve === 'quadratic' ? clamped * clamped : clamped;
  return min + linear * (max - min);
}

/**
 * Compact horizontal slider (the app has none): a track, a thumb, a label with the live value.
 * Drag anywhere on the track. The responder is created once and reads props through a ref, so a
 * re-render mid-drag never resets the gesture.
 */
const SketchSlider: React.FC<SketchSliderProps> = ({
  label,
  value,
  min,
  max,
  onChange,
  valueText,
  curve = 'linear',
  testID,
}) => {
  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const live = useRef({ min, max, onChange, curve, trackWidth });
  useEffect(() => {
    live.current = { min, max, onChange, curve, trackWidth };
  });
  const startX = useRef(0);

  const responder = useMemo(() => {
    const apply = (x: number) => {
      const { min: lo, max: hi, onChange: change, curve: shape, trackWidth: width } = live.current;
      if (width <= 0) return;
      change(fromRatio((x - THUMB / 2) / (width - THUMB), lo, hi, shape));
    };
    // eslint-disable-next-line react-hooks/refs -- handlers touch refs only on gestures; create wires them without invoking any during render.
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        startX.current = event.nativeEvent.locationX;
        apply(startX.current);
      },
      onPanResponderMove: (_, gesture) => apply(startX.current + gesture.dx),
    });
  }, []);

  const ratio = toRatio(value, min, max, curve);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flex: 1, minWidth: 120 },
        head: { flexDirection: 'row', justifyContent: 'space-between' },
        label: { color: colors.textSecondary, fontSize: 12 },
        valueText: { color: colors.text, fontSize: 12, fontWeight: '700' },
        track: { height: HEIGHT, justifyContent: 'center' },
        rail: { height: 4, borderRadius: 2, backgroundColor: colors.border },
        fill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
        thumb: {
          position: 'absolute',
          top: (HEIGHT - THUMB) / 2,
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: colors.primary,
          borderWidth: 2,
          borderColor: colors.surface,
        },
      }),
    [colors],
  );
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.valueText}>{valueText}</Text>
      </View>
      <View
        style={styles.track}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: valueText }}
        {...responder.panHandlers}
      >
        <View style={styles.rail} pointerEvents="none">
          <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        </View>
        <View
          pointerEvents="none"
          style={[styles.thumb, { left: ratio * Math.max(0, trackWidth - THUMB) }]}
        />
      </View>
    </View>
  );
};

export default SketchSlider;
