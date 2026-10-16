import { Ionicons } from '@expo/vector-icons';
import { ENTITY_APPEARANCE, getContrastTextColor, getEntityAppearance } from '@keres/shared';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { type ThemeColors, useTheme } from '@/src/theme';
import { typography } from '@/src/theme/tokens';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export interface MultiSelectOption {
  label: string;
  value: string;
  color?: string;
  /** Optional entity or section icon displayed beside the option in the modal. */
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface MultiSelectGroup {
  key: string;
  label: string;
  /** Entity appearance used when the caller does not need an intentional custom colour. */
  entityType?: keyof typeof ENTITY_APPEARANCE;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  options: MultiSelectOption[];
}

/**
 * What the modal lists: a flat `options` list, or `groups` to choose the type first. One of the two,
 * never both - the type says so instead of a comment.
 */
export type SelectSource =
  | { options: MultiSelectOption[]; groups?: never }
  | { groups: MultiSelectGroup[]; options?: never };

export interface SelectModalProps {
  visible: boolean;
  onClose: () => void;
  source: SelectSource;
  selectedValues: string[];
  onSelectionChange: (selected: string[]) => void;
  /** The header of the modal; inside a group it is that group's name instead. */
  title: string;
  /** One value: choosing closes the modal. */
  singleSelect?: boolean;
  /** Lets a selected single value be cleared by choosing it again. */
  allowDeselect?: boolean;
  /** Maximum number of simultaneous options. Options not yet chosen become unavailable. */
  maxSelections?: number;
  noOptionsText?: string;
  /** It only appears inside a group (a flat list counts as a single group). */
  searchPlaceholder?: string;
}

const FLAT_GROUP_KEY = '__flat__';

/** The groups of a source: a flat list is one synthetic group, which skips the type-picking step. */
export function groupsOf(source: SelectSource): MultiSelectGroup[] {
  return source.groups ?? [{ key: FLAT_GROUP_KEY, label: '', options: source.options ?? [] }];
}

/**
 * The searchable list behind every selector (`MultiSelectPill`, `SingleSelectPill`), driven from outside:
 * whoever owns the trigger owns `visible`. A picker opened by a menu entry or a button of its own uses it
 * directly instead of faking a pill.
 *
 * With several groups the type is asked first, then the entity; with one (a flat list included) it goes
 * straight to the search. The group and the search stay as they were until the next opening resets them:
 * clearing them on close would empty the list while the modal is still fading out, and flash "no options"
 * over it.
 */
const SelectModal: React.FC<SelectModalProps> = ({
  visible,
  onClose,
  source,
  selectedValues,
  onSelectionChange,
  title,
  singleSelect = false,
  allowDeselect = true,
  maxSelections,
  noOptionsText,
  searchPlaceholder,
}) => {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const styles = useThemedStyles(createStyles);
  const groups = useMemo(() => groupsOf(source), [source]);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setSearch('');
      setActiveGroupKey(groups.length === 1 ? (groups[0]?.key ?? null) : null);
    }
  }

  const activeGroup = useMemo(
    () => groups.find((group) => group.key === activeGroupKey) || null,
    [groups, activeGroupKey],
  );

  const visibleOptions = useMemo(() => {
    if (!activeGroup) return [];
    const query = search.trim().toLowerCase();
    if (!query) return activeGroup.options;
    return activeGroup.options.filter((option) => option.label.toLowerCase().includes(query));
  }, [activeGroup, search]);

  const groupAppearance = useCallback(
    (group: MultiSelectGroup) => {
      const appearanceKey = group.entityType ?? group.key;
      const defaultAppearance = Object.hasOwn(ENTITY_APPEARANCE, appearanceKey)
        ? getEntityAppearance(appearanceKey, isDarkMode)
        : undefined;
      return {
        icon: group.icon ?? (defaultAppearance?.icon as keyof typeof Ionicons.glyphMap | undefined),
        color: group.color ?? defaultAppearance?.color,
      };
    },
    [isDarkMode],
  );

  const toggleOption = (value: string) => {
    if (
      !singleSelect &&
      maxSelections !== undefined &&
      !selectedValues.includes(value) &&
      selectedValues.length >= maxSelections
    ) {
      return;
    }
    const newSelection = singleSelect
      ? selectedValues.includes(value) && allowDeselect
        ? []
        : [value]
      : selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value];
    onSelectionChange(newSelection);
    if (singleSelect) onClose();
  };

  const openGroup = (groupKey: string) => {
    setSearch('');
    setActiveGroupKey(groupKey);
  };

  const backToGroups = () => {
    setSearch('');
    setActiveGroupKey(null);
  };

  const insideGroup = !!activeGroup && groups.length > 1;
  const showGroupPicker = !activeGroup && groups.length > 1;

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      maxHeight={Math.min(screenHeight * 0.75, 720)}
    >
      <View style={{ flexShrink: 1 }}>
        <ModalHeader
          bordered
          singleLine
          title={insideGroup ? activeGroup.label : title}
          leading={
            insideGroup ? (
              <TouchableOpacity
                onPress={backToGroups}
                accessibilityRole="button"
                accessibilityLabel={t('go_back')}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </TouchableOpacity>
            ) : null
          }
          onClose={onClose}
        />

        {activeGroup && (
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={searchPlaceholder || t('search')}
            placeholderTextColor={colors.textSecondary}
            autoFocus
          />
        )}

        <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
          {showGroupPicker ? (
            groups.map((group) => {
              const appearance = groupAppearance(group);
              const selectedCount = group.options.filter((option) =>
                selectedValues.includes(option.value),
              ).length;
              const empty = group.options.length === 0;
              return (
                <TouchableOpacity
                  key={group.key}
                  style={[styles.groupContainer, empty && styles.groupContainerDisabled]}
                  onPress={() => !empty && openGroup(group.key)}
                  disabled={empty}
                >
                  {appearance.icon && (
                    <View
                      style={[
                        styles.groupIcon,
                        { backgroundColor: appearance.color || colors.primaryContainer },
                      ]}
                    >
                      <Ionicons
                        name={appearance.icon}
                        size={18}
                        color={getContrastTextColor(appearance.color || colors.primaryContainer)}
                      />
                    </View>
                  )}
                  <View style={styles.groupTextWrap}>
                    <Text style={styles.groupLabel}>{group.label}</Text>
                    <Text style={styles.groupCount}>
                      {selectedCount > 0
                        ? t('grouped_select_count_selected', {
                            selected: selectedCount,
                            total: group.options.length,
                          })
                        : t('grouped_select_count_total', { total: group.options.length })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              );
            })
          ) : visibleOptions.length > 0 ? (
            visibleOptions.map((option) => {
              const groupOptionAppearance = groupAppearance(activeGroup!);
              const optionIcon = option.icon ?? groupOptionAppearance.icon;
              const optionColor = option.color ?? groupOptionAppearance.color;
              const atSelectionLimit =
                !singleSelect &&
                maxSelections !== undefined &&
                selectedValues.length >= maxSelections &&
                !selectedValues.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  testID={`multiselect-option-${option.value}`}
                  style={[styles.optionContainer, atSelectionLimit && styles.optionDisabled]}
                  onPress={() => toggleOption(option.value)}
                  disabled={atSelectionLimit}
                >
                  <View style={styles.optionLeading}>
                    {optionIcon ? (
                      <View
                        testID={`multiselect-option-icon-${option.value}`}
                        style={[
                          styles.optionIcon,
                          { backgroundColor: optionColor || colors.primaryContainer },
                        ]}
                      >
                        <Ionicons
                          name={optionIcon}
                          size={16}
                          color={getContrastTextColor(optionColor || colors.primaryContainer)}
                        />
                      </View>
                    ) : option.color ? (
                      <View style={[styles.optionColor, { backgroundColor: option.color }]} />
                    ) : null}
                    <Text style={styles.optionText}>{option.label}</Text>
                  </View>
                  <View testID={`multiselect-check-${option.value}`} style={styles.optionCheck}>
                    {selectedValues.includes(option.value) && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.noOptionsText}>{noOptionsText || t('no_tags_available')}</Text>
          )}
        </ScrollView>
      </View>
    </ResponsiveModal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    searchInput: {
      marginHorizontal: 15,
      marginTop: 12,
      marginBottom: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: 15,
    },
    groupContainer: {
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    groupContainerDisabled: {
      opacity: 0.4,
    },
    groupIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    groupTextWrap: {
      flex: 1,
    },
    groupLabel: {
      ...typography.bodyLarge,
      color: colors.text,
    },
    groupCount: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    optionContainer: {
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    optionDisabled: {
      opacity: 0.45,
    },
    optionLeading: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 10,
    },
    optionColor: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionText: {
      ...typography.bodyLarge,
      color: colors.text,
    },
    // The check's space is always reserved: appearing only when ticked, it pushed the row a few pixels
    // down, and the whole list danced with every choice.
    optionCheck: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noOptionsText: {
      padding: 15,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

export default SelectModal;
