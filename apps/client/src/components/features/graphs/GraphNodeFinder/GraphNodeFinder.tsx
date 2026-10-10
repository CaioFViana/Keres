import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme, type ThemeColors } from '../../../../theme';
import { fontSize, radius, space } from '../../../../theme/tokens';
import { useThemedStyles } from '../../../../theme/useThemedStyles';
import ThemedText from '../../../common/display/ThemedText/ThemedText';
import TextInput from '../../../common/inputs/TextInput/TextInput';

export interface GraphNodeFinderOption {
  id: string;
  label: string;
}

interface GraphNodeFinderProps {
  options: GraphNodeFinderOption[];
  placeholder: string;
  /** Called with the id the author picked; the field clears itself. */
  onPick: (id: string) => void;
}

/** How many matches the list shows: enough to choose from, few enough to stay on the canvas. */
export const MAX_FINDER_RESULTS = 6;

/** Lower case, accents off: "joao" finds "João". */
export function foldForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** The options whose label contains the query, those that start with it first. */
export function findOptions(
  options: readonly GraphNodeFinderOption[],
  query: string,
): GraphNodeFinderOption[] {
  const needle = foldForSearch(query);
  if (!needle) return [];
  const starts: GraphNodeFinderOption[] = [];
  const contains: GraphNodeFinderOption[] = [];
  for (const option of options) {
    const label = foldForSearch(option.label);
    if (label.startsWith(needle)) starts.push(option);
    else if (label.includes(needle)) contains.push(option);
  }
  return [...starts, ...contains].slice(0, MAX_FINDER_RESULTS);
}

/**
 * A small search that takes the author to a node: type a name, pick it, and the screen centres and
 * selects it. The focus filter narrows the map; this one leaves it whole and goes to one place on it.
 */
const GraphNodeFinder: React.FC<GraphNodeFinderProps> = ({ options, placeholder, onPick }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const matches = useMemo(() => findOptions(options, query), [options, query]);

  const pick = (id: string) => {
    setQuery('');
    onPick(id);
  };

  return (
    <View style={styles.root}>
      <View style={styles.field}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          accessibilityLabel={placeholder}
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={() => matches[0] && pick(matches[0].id)}
          testID="graph-node-finder-input"
        />
        <View style={styles.icon} pointerEvents="none">
          <Ionicons name="search" size={16} color={colors.textSecondary} />
        </View>
      </View>
      {matches.length > 0 && (
        <View style={styles.list}>
          {matches.map((match) => (
            <TouchableOpacity
              key={match.id}
              style={styles.row}
              onPress={() => pick(match.id)}
              accessibilityRole="button"
              accessibilityLabel={match.label}
            >
              <ThemedText numberOfLines={1}>{match.label}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { marginHorizontal: space.md, marginTop: space.md, zIndex: 20 },
    // The input is the one framed element, so its focus ring (the app's own, on the web) hugs the
    // whole field; the icon sits inside it, over the padding left for it.
    field: { justifyContent: 'center' },
    icon: { position: 'absolute', left: space.lg },
    input: {
      height: 38,
      width: '100%',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      fontSize: fontSize.base,
      color: colors.text,
      paddingLeft: space.lg + 16 + space.md,
      paddingRight: space.lg,
    },
    list: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: space.xxs,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    row: { paddingHorizontal: space.xl, paddingVertical: space.lg },
  });

export default GraphNodeFinder;
