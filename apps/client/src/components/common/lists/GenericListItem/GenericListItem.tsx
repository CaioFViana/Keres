import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../../../theme';

interface GenericListItemProps {
  headerContent: React.ReactNode;
  expandedContent?: React.ReactNode;
  isOpen: boolean;
  onPress: () => void;
  rightActions?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const GenericListItem: React.FC<GenericListItemProps> = ({
  headerContent,
  expandedContent,
  isOpen,
  onPress,
  rightActions,
}) => {
  const { colors } = useTheme();
  const animatedHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0); // This should be a shared value
  const opacity = useSharedValue(isOpen ? 1 : 0);

  React.useEffect(() => {
    if (isOpen) {
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [isOpen, opacity]);

  useAnimatedReaction(
    () => ({ isOpen, contentHeight: contentHeight.value }),
    (snapshot) => {
      if (snapshot.isOpen) {
        animatedHeight.value = withTiming(snapshot.contentHeight, { duration: 300 });
      } else {
        animatedHeight.value = withTiming(0, { duration: 300 });
      }
    },
    [isOpen] 
  );

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      height: animatedHeight.value,
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: withTiming(isOpen ? 0 : -contentHeight.value * 0.1, { duration: 300 }) }],
    };
  });

  // Border should stay visible while the collapse animation is still shrinking, not just
  // while `isOpen` is true - reading `animatedHeight.value` for that has to happen here
  // (a worklet), not in the plain StyleSheet below, which runs during render.
  const animatedHeaderStyle = useAnimatedStyle(() => ({
    borderBottomWidth: isOpen || animatedHeight.value > 0 ? 1 : 0,
  }));

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      marginVertical: 4,
      borderRadius: 8,
      overflow: 'hidden',
      borderColor: colors.border,
      borderWidth: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 10,
      borderBottomColor: colors.border,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dropdownArrow: {
      marginLeft: 10,
    },
    measurementContent: {
      position: 'absolute',
      opacity: 0,
      zIndex: -1,
      width: '100%',
    },
    animatedWrapper: {
      overflow: 'hidden',
    },
    expandedContentInner: {
      padding: 10,
    }
  });

  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    // Add a small buffer to the measured height to prevent content from being cut off
    const measuredHeight = event.nativeEvent.layout.height + 20;
    if (contentHeight.value !== measuredHeight) {
      contentHeight.value = measuredHeight;
      if (isOpen) {
        animatedHeight.value = withTiming(contentHeight.value, { duration: 300 });
      }
    }
  }, [isOpen, animatedHeight, contentHeight]);

  return (
    <View style={styles.container}>
      <AnimatedPressable onPress={onPress} style={[styles.header, animatedHeaderStyle]}>
        {headerContent}
        <View style={styles.headerRight}>
          {rightActions}
          <MaterialCommunityIcons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={colors.textSecondary}
            style={styles.dropdownArrow}
          />
        </View>
      </AnimatedPressable>

      <View style={styles.measurementContent} onLayout={onLayout}>
        {expandedContent}
      </View>

      <Animated.View style={[styles.animatedWrapper, animatedContainerStyle]}>
        <Animated.View style={animatedContentStyle}>
          <View style={styles.expandedContentInner}>
            {expandedContent}
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

export default GenericListItem;