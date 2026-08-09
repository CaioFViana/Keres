import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';

interface ResponsiveGridProps {
  children: React.ReactNode;
  compactColumns?: number;
  mediumColumns?: number;
  wideColumns?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

/** A small layout primitive for cards/tiles that must reflow with the window. */
const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  compactColumns = 2,
  mediumColumns = 3,
  wideColumns = 5,
  gap = 10,
  style,
}) => {
  const { breakpoint } = useResponsiveLayout();
  const columns = breakpoint === 'wide'
    ? wideColumns
    : breakpoint === 'medium'
      ? mediumColumns
      : compactColumns;

  const itemWidth = `${100 / columns}%` as `${number}%`;

  return (
    <View style={[styles.grid, { marginHorizontal: -gap / 2 }, style]}>
      {React.Children.map(children, (child, index) => (
        <View key={index} style={{ width: itemWidth, paddingHorizontal: gap / 2 }}>
          {child}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

export default ResponsiveGrid;

