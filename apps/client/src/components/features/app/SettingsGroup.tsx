import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme';

interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
}

/**
 * A titled card of settings: the rows sit inside one rounded surface and are told apart by a thin
 * line, so a long screen reads as a few groups instead of one list of unrelated rows.
 */
const SettingsGroup: React.FC<SettingsGroupProps> = ({ title, children }) => {
  const { colors } = useTheme();
  const rows = React.Children.toArray(children);
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textSecondary }]}>
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {rows.map((row, index) => (
          <React.Fragment key={React.isValidElement(row) ? (row.key ?? index) : index}>
            {index > 0 ? (
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            ) : null}
            {row}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  group: { marginTop: 22 },
  title: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
});

export default SettingsGroup;
