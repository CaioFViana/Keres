import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../theme';

interface DrawerIconWithMarkProps {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  size: number;
  /** A received-message mark on the corner of the icon. */
  marked: boolean;
  /** What the icon says when it is marked, for screen readers. */
  markedLabel: string;
  testID?: string;
}

/** A menu icon that wears a small received-message mark while there is something unopened behind it. */
const DrawerIconWithMark: React.FC<DrawerIconWithMarkProps> = ({
  name,
  color,
  size,
  marked,
  markedLabel,
  testID = 'unseen-messages-mark',
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={marked ? markedLabel : undefined}
    >
      <Ionicons name={name} color={color} size={size} />
      {marked ? (
        <View testID={testID} style={[styles.mark, { backgroundColor: colors.background }]}>
          <Ionicons name="chatbubble" color={colors.error} size={Math.round(size * 0.6)} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  mark: {
    position: 'absolute',
    top: -5,
    right: -7,
    borderRadius: 999,
    padding: 1,
  },
});

export default DrawerIconWithMark;
