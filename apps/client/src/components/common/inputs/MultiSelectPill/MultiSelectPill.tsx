import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { Ionicons } from '@expo/vector-icons';
import { ENTITY_APPEARANCE, getContrastTextColor, getEntityAppearance } from '@keres/shared';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../../../../theme';

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

/** Compatibility shape for places that previously needed a one-value dropdown. */
export interface SingleSelectPillProps {
  options: (Omit<MultiSelectOption, 'color'> & { color?: string | null })[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  /** Kept for call-site readability; this component always chooses one value. */
  multiple?: false;
  disabled?: boolean;
  allowDeselect?: boolean;
}

interface MultiSelectPillProps {
  /** A flat list in a single modal - good for a handful of options (tags, say). */
  options?: MultiSelectOption[];
  /**
   * Selection in two steps: the type first, then the entity - good when there are hundreds of options of
   * different types (an entity selector, say). Exactly one of the two (`options` or `groups`) has to
   * be passed.
   */
  groups?: MultiSelectGroup[];
  selectedValues: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
  noOptionsText?: string;
  /** It only appears inside a group (a flat list counts as a single group). */
  searchPlaceholder?: string;
  /** Limits the selection to one value and closes the modal after the choice. */
  singleSelect?: boolean;
  /** Lets a selected single value be cleared by choosing it again. */
  allowDeselect?: boolean;
  /** Maximum number of simultaneous options. Options not yet chosen become unavailable. */
  maxSelections?: number;
  /** Makes the trigger inert while retaining its current value. */
  disabled?: boolean;
  /** Ajustes de layout para contextos compactos, como barras de filtro. */
  style?: StyleProp<ViewStyle>;
  triggerStyle?: StyleProp<ViewStyle>;
  pillStyle?: StyleProp<ViewStyle>;
  /** Compact text for large selections, without losing the real selection inside the modal. */
  selectionSummary?: string;
}

const FLAT_GROUP_KEY = '__flat__';

/**
 * A single component for two modes that used to be two nearly identical components
 * (`MultiSelectPill`/`GroupedMultiSelectPill`, ~150 duplicated lines of style/animation): `options`
 * flattens the list straight into one modal; `groups` asks for the type first. When there is only one
 * group (a flat `options`, or `groups` with a single item), the type-picking step is skipped - the same
 * path used by a one-type entity selector in `singleSelect` mode.
 */
const MultiSelectPill: React.FC<MultiSelectPillProps> = ({
  options,
  groups,
  selectedValues,
  onSelectionChange,
  placeholder,
  label,
  noOptionsText,
  searchPlaceholder,
  singleSelect = false,
  allowDeselect = true,
  maxSelections,
  disabled = false,
  style,
  triggerStyle,
  pillStyle,
  selectionSummary,
}) => {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const [modalVisible, setModalVisible] = useState(false);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const effectiveGroups = useMemo<MultiSelectGroup[]>(
    () => groups ?? [{ key: FLAT_GROUP_KEY, label: '', options: options ?? [] }],
    [groups, options],
  );

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

  const optionsByValue = useMemo(() => {
    const map = new Map<string, MultiSelectOption>();
    for (const group of effectiveGroups) {
      for (const option of group.options) {
        map.set(option.value, option);
      }
    }
    return map;
  }, [effectiveGroups]);

  const selectedOptionDetails = useMemo(
    () =>
      (singleSelect ? selectedValues.slice(0, 1) : selectedValues)
        .map((value) => optionsByValue.get(value))
        .filter(Boolean) as MultiSelectOption[],
    [selectedValues, optionsByValue, singleSelect],
  );

  const activeGroup = useMemo(
    () => effectiveGroups.find((group) => group.key === activeGroupKey) || null,
    [effectiveGroups, activeGroupKey],
  );

  const visibleOptions = useMemo(() => {
    if (!activeGroup) return [];
    const query = search.trim().toLowerCase();
    if (!query) return activeGroup.options;
    return activeGroup.options.filter((option) => option.label.toLowerCase().includes(query));
  }, [activeGroup, search]);

  const openModal = useCallback(() => {
    setSearch('');
    setActiveGroupKey(effectiveGroups.length === 1 ? (effectiveGroups[0]?.key ?? null) : null);
    setModalVisible(true);
  }, [effectiveGroups]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    // It resets to the type list on the next opening, instead of reopening inside the last visited group.
    setActiveGroupKey(null);
    setSearch('');
  }, []);

  const toggleOption = useCallback(
    (value: string) => {
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
      if (singleSelect) {
        closeModal();
      }
    },
    [selectedValues, onSelectionChange, singleSelect, allowDeselect, maxSelections, closeModal],
  );

  const openGroup = useCallback((groupKey: string) => {
    setSearch('');
    setActiveGroupKey(groupKey);
  }, []);

  const backToGroups = useCallback(() => {
    setSearch('');
    setActiveGroupKey(null);
  }, []);

  const showGroupPicker = !activeGroup && effectiveGroups.length > 1;
  const singleValueAppearance = singleSelect || maxSelections === 1;

  const styles = StyleSheet.create({
    container: {
      marginBottom: 10,
    },
    label: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 5,
    },
    pillContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 10,
      minHeight: 50,
      alignItems: 'center',
      borderColor: colors.primary,
      borderWidth: 1,
      // The spacing between pills belongs to the container, not to each pill. With a margin on each one, the
      // last still charged its bottom margin: the field grew when the first option was chosen and the pill
      // sat above the centre, with 8px of slack underneath it.
      gap: 8,
    },
    singleValueContainer: {
      flexWrap: 'nowrap',
      borderRadius: 5,
    },
    singleValueText: {
      color: colors.text,
      fontSize: 16,
      flexShrink: 1,
    },
    disabled: {
      opacity: 0.4,
    },
    pill: {
      flexDirection: 'row',
      borderRadius: 15,
      paddingVertical: 5,
      paddingHorizontal: 10,
      alignItems: 'center',
    },
    pillText: {
      fontSize: 14,
    },
    placeholderText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
    selectionSummary: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderRadius: 10,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalHeaderTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
    },
    backButton: {
      padding: 5,
      marginRight: 5,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      flexShrink: 1,
    },
    closeButton: {
      padding: 5,
    },
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
      fontSize: 16,
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
      fontSize: 16,
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

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        testID="multiselect-trigger"
        onPress={openModal}
        disabled={disabled}
        style={[
          styles.pillContainer,
          singleValueAppearance && styles.singleValueContainer,
          disabled && styles.disabled,
          triggerStyle,
        ]}
      >
        {selectionSummary ? (
          <Text style={styles.selectionSummary}>{selectionSummary}</Text>
        ) : singleValueAppearance && selectedOptionDetails[0] ? (
          <Text style={styles.singleValueText} numberOfLines={1}>
            {selectedOptionDetails[0].label}
          </Text>
        ) : selectedOptionDetails.length > 0 ? (
          selectedOptionDetails.map((option) => {
            const pillBackgroundColor = option.color || colors.primaryContainer;
            const pillTextColor = getContrastTextColor(pillBackgroundColor);
            return (
              <View
                key={option.value}
                testID={`multiselect-pill-${option.value}`}
                style={[styles.pill, pillStyle, { backgroundColor: pillBackgroundColor }]}
              >
                <Text style={[styles.pillText, { color: pillTextColor }]}>{option.label}</Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.placeholderText}>{placeholder || t('select_tags')}</Text>
        )}
        <Ionicons
          name={singleValueAppearance ? 'chevron-down' : 'add-circle'}
          size={24}
          color={colors.primary}
          style={{ marginLeft: 'auto' }}
        />
      </TouchableOpacity>

      <ResponsiveModal
        visible={modalVisible}
        onClose={closeModal}
        contentStyle={styles.modalContent}
        maxHeight={Math.min(screenHeight * 0.75, 720)}
      >
        <View style={{ flexShrink: 1 }}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              {activeGroup && effectiveGroups.length > 1 && (
                <TouchableOpacity onPress={backToGroups} style={styles.backButton}>
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                </TouchableOpacity>
              )}
              <Text style={styles.modalTitle} numberOfLines={1}>
                {activeGroup && effectiveGroups.length > 1
                  ? activeGroup.label
                  : label || placeholder || t('select_tags')}
              </Text>
            </View>
            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

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
              effectiveGroups.map((group) => {
                const appearance = groupAppearance(group);
                const selectedCount = group.options.filter((option) =>
                  selectedValues.includes(option.value),
                ).length;
                const disabled = group.options.length === 0;
                return (
                  <TouchableOpacity
                    key={group.key}
                    style={[styles.groupContainer, disabled && styles.groupContainerDisabled]}
                    onPress={() => !disabled && openGroup(group.key)}
                    disabled={disabled}
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
    </View>
  );
};

/** A searchable, text-input-shaped single selector backed by `MultiSelectPill`. */
export const SingleSelectPill: React.FC<SingleSelectPillProps> = ({
  options,
  value,
  onValueChange,
  placeholder,
  disabled,
  allowDeselect = false,
}) => (
  <MultiSelectPill
    options={options.map((option) => ({ ...option, color: option.color ?? undefined }))}
    selectedValues={value ? [value] : []}
    onSelectionChange={(values) => onValueChange(values[0] ?? null)}
    placeholder={placeholder}
    singleSelect
    allowDeselect={allowDeselect}
    disabled={disabled}
  />
);

export default MultiSelectPill;
