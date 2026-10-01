import { Ionicons } from '@expo/vector-icons';
import { getReadableInk } from '@keres/shared';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../../../theme';
import type { WelcomeHeroIcon } from './welcomeContent';

/**
 * The Keres emblem as a hole: everything around the figure is opaque, the figure itself is clear.
 * Painted in the surface color over a gradient, it leaves the gradient showing as the figure - a
 * gradient inside a shape without a masking dependency. Made from the app icon (`icon_keres.png`).
 */
const EMBLEM = require('../../../../assets/images/welcome-emblem.png');

export type WelcomeHeroSize = 'regular' | 'large';

const DIMENSIONS: Record<WelcomeHeroSize, { panel: number; badge: number; icon: number }> = {
  regular: { panel: 210, badge: 112, icon: 54 },
  large: { panel: 360, badge: 176, icon: 84 },
};

/** A ring that grows and fades as the pulse runs from 0 to 1; the phase staggers it from its twin. */
const PulseRing: React.FC<{
  pulse: SharedValue<number>;
  phase: number;
  style: StyleProp<ViewStyle>;
}> = ({ pulse, phase, style }) => {
  const animated = useAnimatedStyle(() => {
    const t = (pulse.value + phase) % 1;
    return {
      opacity: interpolate(t, [0, 1], [0.35, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(t, [0, 1], [1, 1.9], Extrapolation.CLAMP) }],
    };
  });
  return <Animated.View style={[style, animated]} />;
};

interface WelcomeHeroProps {
  icon: WelcomeHeroIcon;
  /** The page's place in the pager, and how far the pager has scrolled: what moves the badge. */
  index: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  /** How wide the picture is: the whole page when stacked, a part of it beside the text. */
  width: number;
  size?: WelcomeHeroSize;
  /** The first step arrives with a little flourish; the others are brought in by the swipe. */
  entrance?: boolean;
}

/**
 * The picture of a welcome step: a colored panel with a badge in its middle that floats, pulses a
 * pair of rings outward, and slides a little slower than the page when the pager is swiped - the
 * three things that make a first-run feel like a place rather than a form. Everything that loops
 * stands still for people who asked the system to reduce motion.
 */
const WelcomeHero: React.FC<WelcomeHeroProps> = ({
  icon,
  index,
  scrollX,
  pageWidth,
  width,
  size = 'regular',
  entrance = false,
}) => {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  const float = useSharedValue(0);
  const dimensions = DIMENSIONS[size];

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
    float.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [reduceMotion, pulse, float]);

  const badgeStyle = useAnimatedStyle(() => {
    const distance = (scrollX.value - index * pageWidth) / pageWidth;
    const away = Math.abs(distance);
    return {
      opacity: interpolate(away, [0, 0.9], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: distance * -pageWidth * 0.3 },
        { translateY: float.value },
        { scale: interpolate(away, [0, 1], [1, 0.7], Extrapolation.CLAMP) },
      ],
    };
  });

  // The figure's gradient runs from the brand color to a second one made readable on the surface.
  const figureColors = [
    colors.primary,
    getReadableInk(colors.secondary, colors.background, 3),
  ] as const;

  const styles = StyleSheet.create({
    panel: {
      width: '100%',
      height: dimensions.panel,
      borderRadius: 28,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ring: {
      position: 'absolute',
      width: dimensions.badge,
      height: dimensions.badge,
      borderRadius: dimensions.badge / 2,
      borderWidth: 2,
      borderColor: colors.background,
    },
    badge: {
      width: dimensions.badge,
      height: dimensions.badge,
      borderRadius: dimensions.badge / 2,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    fill: StyleSheet.absoluteFill,
    emblem: { width: dimensions.badge, height: dimensions.badge },
  });

  return (
    <View style={{ width }} testID={`welcome-hero-${index}`}>
      <Animated.View entering={entrance ? ZoomIn.duration(520) : undefined}>
        <LinearGradient
          colors={[colors.primary, colors.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.panel}
        >
          <PulseRing pulse={pulse} phase={0.5} style={styles.ring} />
          <PulseRing pulse={pulse} phase={0} style={styles.ring} />
          <Animated.View style={[styles.badge, badgeStyle]}>
            {icon === 'logo' ? (
              <>
                <LinearGradient
                  colors={figureColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.fill}
                />
                <Image
                  source={EMBLEM}
                  style={[styles.emblem, { tintColor: colors.background }]}
                  accessibilityIgnoresInvertColors
                />
              </>
            ) : (
              <Ionicons name={icon} size={dimensions.icon} color={colors.primary} />
            )}
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

export default WelcomeHero;
