import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../../theme';

interface CollapsibleCardProps {
  title: string;
  children: React.ReactNode;
  initialExpanded?: boolean;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({ title, children, initialExpanded = true }) => {
  const [expanded, setExpanded] = React.useState(initialExpanded);
  const { colors } = useTheme();

  const animatedHeight = useSharedValue(initialExpanded ? 1 : 0); // Use 0/1 for state, then map to actual height
  const contentHeight = useSharedValue(0);
  const opacity = useSharedValue(initialExpanded ? 1 : 0);

  const toggleExpanded = () => {
    setExpanded(prev => !prev);
  };

  React.useEffect(() => {
    if (expanded) {
      animatedHeight.value = withTiming(contentHeight.value, { duration: 300 }); // ContentHeight already includes padding + buffer
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      animatedHeight.value = withTiming(0, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [expanded, contentHeight.value]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      height: animatedHeight.value,
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: withTiming(expanded ? 0 : -contentHeight.value * 0.1, { duration: 300 }) }],
    };
  });

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
      borderBottomWidth: expanded || animatedHeight.value > 0 ? 1 : 0,
      borderBottomColor: colors.border,
    },
    titleText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    // The measurement content should be invisible and take no space
    measurementContent: {
      position: 'absolute',
      opacity: 0,
      zIndex: -1,
      width: '100%',
      // Apply the same padding here as in childrenWrapper to get an accurate measurement
      padding: 15, 
    },
    animatedWrapper: {
      overflow: 'hidden',
    },
    childrenWrapper: {
      padding: 15, // Apply padding to the inner content
    }
  });

  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    // measuredHeight will now include the 15px padding from measurementContent
    const measuredHeight = event.nativeEvent.layout.height + 5; // Add a small additional buffer
    if (contentHeight.value !== measuredHeight) {
      contentHeight.value = measuredHeight;
      if (expanded) {
        animatedHeight.value = withTiming(contentHeight.value, { duration: 300 });
      }
    }
  }, [expanded]);


  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggleExpanded} style={styles.header}>
        <Text style={styles.titleText}>{title}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={colors.text}
        />
      </TouchableOpacity>

      {/* This View is for measuring the content's natural height */}
      <View style={styles.measurementContent} onLayout={onLayout}>
        {children}
      </View>

      <Animated.View style={[styles.animatedWrapper, animatedContainerStyle]}>
        <Animated.View style={animatedContentStyle}>
          <View style={styles.childrenWrapper}>
            {children}
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

export default CollapsibleCard;
