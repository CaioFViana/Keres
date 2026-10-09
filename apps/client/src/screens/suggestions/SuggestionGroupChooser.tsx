import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';

/**
 * One list of suggestions. `label` is its full name ("Characters · Role"); `section` and `short` are the
 * halves of it, for a list that shows the section once and the short names under it.
 */
export type SuggestionGroup = {
  type: string;
  label: string;
  section: string;
  short: string;
  key: string;
  name?: string;
};

/** More lists than this and the chooser gets a search field: finding one by eye is slower than typing. */
const SEARCH_FROM_GROUPS = 8;

interface SuggestionGroupChooserProps {
  groups: readonly SuggestionGroup[];
  selectedType: string | null;
  onSelect: (type: string) => void;
  /** A narrow screen has room for one searchable picker; a wide one lists the lists beside the values. */
  compact: boolean;
}

/**
 * Picks which list of suggestions to look at. There are dozens of them (every field that suggests, every
 * custom field, the person's own lists), so it is a searchable picker on a narrow screen and, on a wide
 * one, a column grouped under the entity each belongs to.
 */
const SuggestionGroupChooser: React.FC<SuggestionGroupChooserProps> = ({
  groups,
  selectedType,
  onSelect,
  compact,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? groups.filter((group) => group.label.toLowerCase().includes(query)) : groups;
  }, [groups, search]);

  if (compact) {
    return (
      <View style={styles.picker} testID="suggestion-group-picker">
        <SingleSelectPill
          value={selectedType}
          onValueChange={(value) => value && onSelect(value)}
          options={groups.map((group) => ({ value: group.type, label: group.label }))}
          placeholder={t('suggestion_choose_list')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.pane, { borderRightColor: colors.border }]}>
      {groups.length > SEARCH_FROM_GROUPS && (
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('suggestion_search_lists')}
          style={styles.search}
          testID="suggestion-group-search"
        />
      )}
      <ScrollView style={styles.column}>
        {visible.map((group, index) => {
          const selected = selectedType === group.type;
          return (
            <View key={group.type}>
              {visible[index - 1]?.section !== group.section && (
                <Text
                  accessibilityRole="header"
                  style={[styles.section, { color: colors.textSecondary }]}
                >
                  {group.section}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => onSelect(group.type)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={group.label}
                style={[styles.item, selected && { backgroundColor: colors.primaryContainer }]}
              >
                <Text style={{ color: colors.text, fontWeight: selected ? '700' : 'normal' }}>
                  {group.short}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  picker: { marginBottom: 14 },
  pane: { width: 300, borderRightWidth: 1, paddingRight: 16 },
  search: { marginBottom: 8, width: undefined },
  column: { flex: 1 },
  section: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  item: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6 },
});

export default SuggestionGroupChooser;
