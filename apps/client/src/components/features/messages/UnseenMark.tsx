import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../theme';

export interface UnseenMarkProps {
  /** Where the dot sits on whatever it marks; the corner by default. */
  offset?: { top?: number; right?: number };
  testID?: string;
}

/**
 * The small dot that says "there is something new here": on the chat button of a friend, on the row of a
 * server, on a conversation of the inbox. One look everywhere, so it is learned once. It carries no number
 * and no words - the control it sits on says what it is for (see the accessibility labels there).
 */
const UnseenMark: React.FC<UnseenMarkProps> = ({ offset, testID = 'unseen-mark' }) => {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[
        styles.dot,
        {
          backgroundColor: colors.error,
          borderColor: colors.background,
          top: offset?.top ?? -3,
          right: offset?.right ?? -3,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});

export default UnseenMark;
