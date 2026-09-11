import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Easing, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/theme';
import { getContrastTextColor } from '@keres/shared';

interface ThemedSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

/** An accessible switch with theme-controlled colours, without resorting to Android's native thumb. */
const ThemedSwitch: React.FC<ThemedSwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  style,
  testID,
  accessibilityLabel,
}) => {
  const { colors } = useTheme();
  const thumbPosition = useRef(new Animated.Value(value ? 1 : 0)).current;
  const isInitialRender = useRef(true);

  useEffect(() => {
    // The initial value is already represented by `thumbPosition`; animating it on mount only
    // schedules needless frames (and causes React test updates outside the initiating act).
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    const animation = Animated.timing(thumbPosition, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    animation.start();
    return () => animation.stop();
  }, [thumbPosition, value]);

  const translateX = thumbPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });
  const trackColor = thumbPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });
  const thumbColor = thumbPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textSecondary, colors.primaryContainer],
  });
  const targetThumbColor = value ? colors.primaryContainer : colors.textSecondary;

  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      testID={testID}
      onPress={() => onValueChange(!value)}
      style={[
        styles.track,
        {
          backgroundColor: trackColor,
          borderColor: trackColor,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: thumbColor,
            shadowColor: colors.shadow,
            transform: [{ translateX }],
          },
        ]}
      >
        <Ionicons
          name={value ? 'checkmark' : 'close'}
          size={17}
          color={getContrastTextColor(targetThumbColor)}
        />
      </Animated.View>
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  track: {
    width: 50,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    padding: 2,
    justifyContent: 'center',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.28,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});

export default ThemedSwitch;
