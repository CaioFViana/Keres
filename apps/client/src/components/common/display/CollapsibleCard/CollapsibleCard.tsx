import React from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../../../theme';

interface CollapsibleCardProps {
  title: string;
  children: React.ReactNode;
  initialExpanded?: boolean;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const DURATION = 300;

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  children,
  initialExpanded = true,
}) => {
  const [expanded, setExpanded] = React.useState(initialExpanded);
  const { colors } = useTheme();

  const animatedHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  // A mirror of `expanded`: `useAnimatedReaction` only re-runs for the shared values its first
  // worklet reads, so React state alone never triggers it (the card would open with its content
  // at height zero - header flipped, nothing underneath).
  const expandedValue = useSharedValue(initialExpanded);

  const toggleExpanded = () => {
    setExpanded((prev) => !prev);
  };

  React.useEffect(() => {
    expandedValue.value = expanded;
  }, [expanded, expandedValue]);

  useAnimatedReaction(
    () => ({ open: expandedValue.value, height: contentHeight.value }),
    (current, previous) => {
      const target = current.open ? current.height : 0;
      if (previous !== null && previous.open !== current.open) {
        // The reader tapped the header: animate.
        animatedHeight.value = withTiming(target, { duration: DURATION });
      } else {
        // First measurement, or the content itself changed size (a relation was added, the
        // screen was reused for another entity). Snapping avoids leaving the card at the old
        // entity's height while the new content is already on screen.
        animatedHeight.value = target;
      }
    },
  );

  const animatedContainerStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: withTiming(expandedValue.value ? 1 : 0, { duration: DURATION }),
  }));

  // Border should stay visible while the collapse animation is still shrinking, not just
  // while `expanded` is true - reading `animatedHeight.value` for that has to happen here
  // (a worklet), not in the plain StyleSheet below, which runs during render.
  const animatedHeaderStyle = useAnimatedStyle(() => ({
    borderBottomWidth: expandedValue.value || animatedHeight.value > 0 ? 1 : 0,
  }));

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: 8,
      marginBottom: 10,
      overflow: 'hidden',
      borderColor: colors.border,
      borderWidth: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 15,
      borderBottomColor: colors.border,
    },
    titleText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    animatedWrapper: {
      overflow: 'hidden',
    },
    // Absolute so the wrapper's animated height never squashes the content: the children keep
    // their natural height, which is exactly what `onLayout` reports back as the open height.
    // Measuring the content that is actually shown (instead of a hidden second copy of it, as
    // this card used to do) is what keeps the two from drifting apart.
    childrenWrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      padding: 15,
    },
  });

  const onLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const measuredHeight = event.nativeEvent.layout.height;
      if (measuredHeight > 0 && contentHeight.value !== measuredHeight) {
        contentHeight.value = measuredHeight;
      }
    },
    [contentHeight],
  );

  return (
    <View style={styles.container}>
      <AnimatedTouchableOpacity
        onPress={toggleExpanded}
        style={[styles.header, animatedHeaderStyle]}
      >
        <Text style={styles.titleText}>{title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={24} color={colors.text} />
      </AnimatedTouchableOpacity>

      <Animated.View style={[styles.animatedWrapper, animatedContainerStyle]}>
        <Animated.View
          style={[styles.childrenWrapper, animatedContentStyle]}
          onLayout={onLayout}
          pointerEvents={expanded ? 'auto' : 'none'}
        >
          {children}
        </Animated.View>
      </Animated.View>
    </View>
  );
};

export default CollapsibleCard;
