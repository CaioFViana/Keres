import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../../../theme';

interface WelcomeProgressProps {
  /** The page on screen, for whoever reads the dots out. */
  current: number;
  total: number;
  scrollX: SharedValue<number>;
  pageWidth: number;
  /** A dot taken as a button: asks for the page it stands for. */
  onSelect: (page: number) => void;
}

/** One dot per step: the current one stretches into a pill as the swipe reaches it. */
const Dot: React.FC<{
  index: number;
  selected: boolean;
  scrollX: SharedValue<number>;
  pageWidth: number;
  onSelect: (page: number) => void;
}> = ({ index, selected, scrollX, pageWidth, onSelect }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const at = pageWidth > 0 ? scrollX.value / pageWidth : 0;
    const near = interpolate(at, [index - 1, index, index + 1], [0, 1, 0], Extrapolation.CLAMP);
    return { width: 8 + 18 * near, opacity: 0.35 + 0.65 * near };
  });
  return (
    // The dot is small; what takes the tap is the padding around it.
    <TouchableOpacity
      onPress={() => onSelect(index)}
      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
      accessibilityRole="button"
      accessibilityLabel={t('welcome_go_to_step', { step: index + 1 })}
      accessibilityState={{ selected }}
      style={{ paddingHorizontal: 4, paddingVertical: 6 }}
      testID={`welcome-dot-${index}`}
    >
      <Animated.View
        style={[{ height: 8, borderRadius: 4, backgroundColor: colors.primary }, style]}
      />
    </TouchableOpacity>
  );
};

/** The dots are the way to see where you are - "Step 2 of 3" - and a way to go to any of them. */
const WelcomeProgress: React.FC<WelcomeProgressProps> = ({
  current,
  total,
  scrollX,
  pageWidth,
  onSelect,
}) => {
  const { t } = useTranslation();

  return (
    <View
      style={styles.row}
      accessibilityLabel={t('welcome_step_of', { current: current + 1, total })}
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}
      testID="welcome-progress"
    >
      {Array.from({ length: total }, (_, index) => (
        <Dot
          key={index}
          index={index}
          selected={index === current}
          scrollX={scrollX}
          pageWidth={pageWidth}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});

export default WelcomeProgress;
