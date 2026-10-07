import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  /** What is changed on the row: a switch, a button. Sits at the right of the text. */
  control?: React.ReactNode;
  /** What is changed on the row when it needs the width: a field or a list, under the text. */
  below?: React.ReactNode;
  /** A row that does something when touched, drawn with a chevron. */
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
}

/** One setting: an icon tile, what it is called, a line saying what it does now, and how to change it. */
const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  hint,
  control,
  below,
  onPress,
  destructive = false,
  testID,
}) => {
  const { colors } = useTheme();
  const tone = destructive ? colors.error : colors.onPrimaryContainer;
  const tile = destructive ? `${colors.error}22` : colors.primaryContainer;

  const content = (
    <>
      <View style={styles.top}>
        <View style={[styles.tile, { backgroundColor: tile }]}>
          <Ionicons name={icon} size={19} color={tone} />
        </View>
        <View style={styles.text}>
          <Text style={[styles.label, { color: destructive ? colors.error : colors.text }]}>
            {label}
          </Text>
          {hint ? <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
        </View>
        {control}
        {onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        ) : null}
      </View>
      {below ? <View style={styles.below}>{below}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.row}
        onPress={onPress}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return (
    <View testID={testID} style={styles.row}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { paddingHorizontal: 14, paddingVertical: 12 },
  top: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 36 },
  tile: {
    alignItems: 'center',
    borderRadius: 9,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  text: { flexGrow: 1, flexShrink: 1 },
  label: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  below: { marginLeft: 48, marginTop: 10 },
});

export default SettingsRow;
