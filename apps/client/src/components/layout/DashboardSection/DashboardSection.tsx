import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme';

interface DashboardSectionProps {
  title: string;
  /** What belongs at the end of the heading line: a link, a status. */
  action?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * A block of the story's home: a small label with its action beside it, and the content under it.
 * Every block of the dashboard uses it, so the page reads as one set of parts and not as cards that
 * each brought their own heading.
 */
const DashboardSection: React.FC<DashboardSectionProps> = ({ title, action, children }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: 22 },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 8,
    marginHorizontal: 2,
    minHeight: 28,
  },
  title: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});

export default DashboardSection;
