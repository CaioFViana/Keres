import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme';

export interface DetailTabItem<K extends string> {
  key: K;
  label: string;
}

interface DetailTabsProps<K extends string> {
  tabs: readonly DetailTabItem<K>[];
  value: K;
  onChange: (key: K) => void;
}

/**
 * The tab bar of a detail screen. It spans the screen's full width (the content around it is padded),
 * so it is meant to be the sticky header of `DetailContainer`'s scroll view.
 */
export function DetailTabs<K extends string>({ tabs, value, onChange }: DetailTabsProps<K>) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}
    >
      {tabs.map((tab) => {
        const selected = tab.key === value;
        return (
          <TouchableOpacity
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            testID={`detail-tab-${tab.key}`}
            style={[styles.tab, { borderBottomColor: selected ? colors.primary : 'transparent' }]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: selected ? colors.primary : colors.textSecondary },
                selected && styles.labelSelected,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface DetailTabPanelsProps<K extends string> {
  value: K;
  panels: Record<K, React.ReactNode>;
}

/**
 * The content of each tab. A tab is built the first time it is opened - the stats chart and the gallery
 * of a tab nobody opens are never loaded - and then kept, hidden while another tab shows, so what was
 * expanded or scrolled to is still there on return.
 */
export function DetailTabPanels<K extends string>({ value, panels }: DetailTabPanelsProps<K>) {
  const [opened, setOpened] = useState<ReadonlySet<K>>(() => new Set([value]));
  if (!opened.has(value)) setOpened(new Set([...opened, value]));

  return (
    <>
      {(Object.keys(panels) as K[]).map((key) =>
        opened.has(key) ? (
          <View
            key={key}
            testID={`detail-panel-${key}`}
            style={key === value ? undefined : styles.hidden}
          >
            {panels[key]}
          </View>
        ) : null,
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    // The content is padded by 20 on each side; the bar runs edge to edge with the same inset inside.
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    // The scroll view's `stickyHeaderIndices` only works natively; on the web the bar sticks by CSS.
    ...(Platform.OS === 'web'
      ? ({ position: 'sticky', top: 0, zIndex: 2 } as unknown as ViewStyle)
      : null),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 3,
    // Sits on the bar's own border, so the selected underline replaces it instead of stacking.
    marginBottom: -1,
  },
  label: {
    fontSize: 15,
  },
  labelSelected: {
    fontWeight: '700',
  },
  hidden: {
    display: 'none',
  },
});
