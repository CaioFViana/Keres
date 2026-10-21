import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';

interface ShowcaseTabsProps<K extends string> {
  tabs: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}

/** The parts of a server's public site, side by side: the one being looked at is filled. */
function ShowcaseTabs<K extends string>({ tabs, value, onChange }: ShowcaseTabsProps<K>) {
  const { colors } = useTheme();

  return (
    <View style={[styles.bar, { borderColor: colors.border }]} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.key === value;
        return (
          <TouchableOpacity
            key={tab.key}
            testID={`showcase-tab-${tab.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, selected && { backgroundColor: colors.primary }]}
          >
            <Text
              style={[styles.label, { color: selected ? colors.onPrimary : colors.text }]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '600' },
});

export default ShowcaseTabs;
