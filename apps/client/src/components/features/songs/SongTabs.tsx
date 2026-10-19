import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';

export const SONG_TABS = ['words', 'tune', 'details'] as const;
export type SongTab = (typeof SONG_TABS)[number];

interface SongTabsProps {
  value: SongTab;
  onChange: (tab: SongTab) => void;
}

/**
 * The three things a song is, one at a time: its words, its tune and everything else about it. A song
 * edited in one long page made the tune a long scroll away from the words it sings.
 */
const SongTabs: React.FC<SongTabsProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View
      style={[styles.bar, { borderColor: colors.border }]}
      accessibilityRole="tablist"
      testID="song-tabs"
    >
      {SONG_TABS.map((tab) => {
        const selected = tab === value;
        return (
          <TouchableOpacity
            key={tab}
            testID={`song-tab-${tab}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.tab, selected && { backgroundColor: colors.primary }]}
            onPress={() => onChange(tab)}
          >
            <Text
              style={{
                color: selected ? colors.onPrimary : colors.text,
                fontWeight: selected ? '700' : '500',
              }}
            >
              {t(`song_tab_${tab}`)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginVertical: 14,
    overflow: 'hidden',
  },
  tab: { alignItems: 'center', flexGrow: 1, flexBasis: 0, justifyContent: 'center', minHeight: 44 },
});

export default SongTabs;
