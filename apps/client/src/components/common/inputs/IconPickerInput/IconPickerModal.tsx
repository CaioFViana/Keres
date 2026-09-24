import {
  AVATAR_ICON_OPTIONS as SHARED_AVATAR_ICON_OPTIONS,
  KERES_ICON_CATEGORIES,
  KERES_ICONS,
} from '@keres/shared';
import type { KeresIconCategory } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import MapIcon from '@/src/components/common/display/MapIcon/MapIcon';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useResponsiveLayout } from '../../../../hooks/useResponsiveLayout';
import { useIconRecents } from '../../../../hooks/useIconRecents';
import { useTheme } from '../../../../theme';

/**
 * The list lives in `@keres/shared` because the public site draws the same avatar - see
 * `metadata/avatar.ts`. Re-exported here so the existing imports stay valid, and typed as an Ionicons
 * glyph, which is what this app needs.
 */
export const AVATAR_ICON_OPTIONS =
  SHARED_AVATAR_ICON_OPTIONS as readonly (keyof typeof Ionicons.glyphMap)[];

type IconCategory = 'essentials' | KeresIconCategory;

interface PickerOption {
  /** Stored value: a plain Ionicons name, or `keres:<name>`. */
  value: string;
  category: IconCategory;
  /** Lowercase haystack of the name plus search synonyms. */
  keywords: string;
}

interface IconPickerModalProps {
  currentIcon: string | null;
  onSelectIcon: (icon: string) => void;
  onClose: () => void;
  title?: string;
  /** The Ionicons list to pick from - defaults to the avatar set; maps use `MAP_ICON_OPTIONS`. The Keres pack is always appended. */
  options?: readonly string[];
}

const CELL_MARGIN = 4;

/** `keres:bow-arrow` reads as "Bow arrow" for labels and screen readers. */
function prettyName(value: string): string {
  const name = value
    .replace(/^keres:/, '')
    .replace(/-/g, ' ')
    .trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : value;
}

/**
 * The grid changes both its size and column count with the available window. Mobile keeps four
 * columns for comfortable touch targets; wider windows use five or six columns so the picker
 * does not remain a narrow phone-sized strip in the middle of a desktop modal.
 *
 * Past ~40 icons a bare grid stops working, so the ~90 live behind search plus category
 * chips: the query matches names and synonyms, chips narrow to one genre, and recent picks
 * sit above the grid whenever nothing filters it.
 */
const IconPickerModal: React.FC<IconPickerModalProps> = ({
  currentIcon,
  onSelectIcon,
  onClose,
  title,
  options = AVATAR_ICON_OPTIONS,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { breakpoint, isCompact } = useResponsiveLayout();
  const { recents, remember } = useIconRecents();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<IconCategory | 'all'>('all');
  const numColumns = breakpoint === 'wide' ? 6 : breakpoint === 'medium' ? 5 : 4;
  const iconGridSize =
    breakpoint === 'wide'
      ? Math.min(Math.max(screenWidth * 0.42, 360), 520)
      : breakpoint === 'medium'
        ? Math.min(Math.max(screenWidth * 0.5, 320), 420)
        : Math.min(screenWidth * 0.7, 320);
  const iconCellSize = iconGridSize / numColumns - CELL_MARGIN * 2;
  const iconSize = breakpoint === 'wide' ? 32 : breakpoint === 'medium' ? 29 : 26;

  const categoryLabels: Record<IconCategory, string> = {
    essentials: t('icon_category_essentials'),
    kingdoms: t('icon_category_kingdoms'),
    adventure: t('icon_category_adventure'),
    war: t('icon_category_war'),
    magic: t('icon_category_magic'),
    creatures: t('icon_category_creatures'),
    sea: t('icon_category_sea'),
    terrain: t('icon_category_terrain'),
    'scifi-places': t('icon_category_scifi_places'),
    'scifi-tech': t('icon_category_scifi_tech'),
    mystery: t('icon_category_mystery'),
  };
  const categories: (IconCategory | 'all')[] = ['all', 'essentials', ...KERES_ICON_CATEGORIES];
  const allOptions = useMemo<PickerOption[]>(
    () => [
      ...options.map((name) => ({
        value: name,
        category: 'essentials' as IconCategory,
        keywords: name.toLowerCase(),
      })),
      ...KERES_ICONS.map((entry) => ({
        value: `keres:${entry.name}`,
        category: entry.category,
        keywords: `${entry.name} ${entry.keywords.join(' ')}`.toLowerCase(),
      })),
    ],
    [options],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allOptions.filter(
      (option) =>
        (category === 'all' || option.category === category) &&
        (needle === '' || option.keywords.includes(needle)),
    );
  }, [allOptions, category, query]);
  const visibleRecents = useMemo(() => {
    if (query.trim() !== '' || category !== 'all') return [];
    const values = new Set(allOptions.map((option) => option.value));
    return recents.filter((value) => values.has(value));
  }, [allOptions, category, query, recents]);

  const handleSelect = (value: string) => {
    remember(value);
    onSelectIcon(value);
  };

  const styles = StyleSheet.create({
    container: {
      width: iconGridSize + 40,
      // The wrapped chips grow vertically on narrow windows; the cap keeps the whole
      // modal on screen while the grid below yields the room.
      maxHeight: screenHeight - 120,
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.background,
    },
    // The close control lives in the header, not below the grid: on short windows the
    // grid yields its room to the wrapped chips, and a bottom button would clip away
    // with no scroll to reach it. Every fixed row carries flexShrink 0 - the web
    // shrinks flex items by default, which would squeeze e.g. the recents scroller
    // (a squeezed scroller clips its cells); only the grid below may yield.
    header: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
      marginBottom: 12,
    },
    title: {
      flex: 1,
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
    },
    closeButton: {
      padding: 5,
    },
    search: { width: '100%', flexShrink: 0, marginBottom: 12 },
    // Width-bound like the search: on web an unbounded child of a centered column sizes
    // to its content and spills past the modal instead of scrolling. The chips wrap
    // instead of scrolling horizontally, denser on compact windows.
    chips: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      flexShrink: 0,
      gap: 8,
      marginBottom: 12,
    },
    chip: {
      paddingHorizontal: isCompact ? 10 : 14,
      paddingVertical: isCompact ? 6 : 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipSelected: { borderColor: colors.primary },
    chipLabel: { color: colors.textSecondary, fontSize: isCompact ? 12 : 14 },
    chipLabelSelected: { color: colors.primary },
    sectionLabel: {
      alignSelf: 'flex-start',
      flexShrink: 0,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    recents: {
      width: '100%',
      flexShrink: 0,
      marginBottom: 12,
      maxHeight: iconCellSize + CELL_MARGIN * 2,
    },
    grid: {
      justifyContent: 'center',
    },
    cell: {
      width: iconCellSize,
      height: iconCellSize,
      margin: CELL_MARGIN,
      borderRadius: iconCellSize / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.border,
    },
    cellSelected: {
      borderColor: colors.primary,
    },
    empty: { color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 },
    iconList: {
      width: '100%',
      // The only row allowed to yield: grows with its content up to the cap, and
      // shrinks when the container's cap bites (tall wrapped chips on short
      // windows) - the grid scrolls either way.
      flexGrow: 1,
      flexShrink: 1,
      maxHeight: Math.max(220, screenHeight * 0.5),
    },
  });

  const renderCell = (value: string) => (
    <TouchableOpacity
      testID={`icon-cell-${value}`}
      accessibilityRole="button"
      accessibilityLabel={prettyName(value)}
      style={[styles.cell, value === currentIcon && styles.cellSelected]}
      onPress={() => handleSelect(value)}
    >
      <MapIcon name={value} size={iconSize} color={colors.text} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {title ? <Text style={styles.title}>{title}</Text> : <View style={{ flex: 1 }} />}
        <TouchableOpacity
          testID="icon-picker-close"
          accessibilityRole="button"
          accessibilityLabel={t('close')}
          onPress={onClose}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.search}>
        <TextInput
          testID="icon-picker-search"
          value={query}
          onChangeText={setQuery}
          placeholder={t('icon_picker_search')}
          returnKeyType="search"
          autoFocus={Platform.OS === 'web'}
        />
      </View>
      <View testID="icon-picker-categories" style={styles.chips}>
        {categories.map((id) => (
          <TouchableOpacity
            key={id}
            testID={`icon-category-${id}`}
            accessibilityRole="button"
            style={[styles.chip, id === category && styles.chipSelected]}
            onPress={() => setCategory(id)}
          >
            <Text style={[styles.chipLabel, id === category && styles.chipLabelSelected]}>
              {id === 'all' ? t('icon_picker_all') : categoryLabels[id]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {visibleRecents.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>{t('icon_picker_recents')}</Text>
          <ScrollView
            testID="icon-picker-recents"
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.recents}
          >
            {visibleRecents.map((value) => (
              <React.Fragment key={value}>{renderCell(value)}</React.Fragment>
            ))}
          </ScrollView>
        </>
      )}
      <FlatList
        key={`icon-grid-${numColumns}`}
        testID="icon-picker-grid"
        data={visible}
        keyExtractor={(item) => item.value}
        numColumns={numColumns}
        style={styles.iconList}
        contentContainerStyle={styles.grid}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>{t('icon_picker_empty')}</Text>}
        renderItem={({ item }) => renderCell(item.value)}
      />
    </View>
  );
};

export default IconPickerModal;
