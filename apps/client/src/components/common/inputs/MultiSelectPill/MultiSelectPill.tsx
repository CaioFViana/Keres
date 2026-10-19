import SelectModal, {
  groupsOf,
  type MultiSelectGroup,
  type MultiSelectOption,
  type SelectSource,
} from '@/src/components/common/modals/SelectModal/SelectModal';
import { Ionicons } from '@expo/vector-icons';
import { getContrastTextColor } from '@keres/shared';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type ThemeColors, useTheme } from '@/src/theme';
import { typography } from '@/src/theme/tokens';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export type { MultiSelectGroup, MultiSelectOption };

/**
 * A searchable, text-input-shaped single selector: the one-value layer over `MultiSelectPill`. It takes
 * the same wording props (`label`, `noOptionsText`, `searchPlaceholder`) so that no screen has to drop
 * to the pill to word its empty list.
 */
export interface SingleSelectPillProps {
  options: (Omit<MultiSelectOption, 'color'> & { color?: string | null })[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  label?: string;
  noOptionsText?: string;
  searchPlaceholder?: string;
  /** Kept for call-site readability; this component always chooses one value. */
  multiple?: false;
  disabled?: boolean;
  allowDeselect?: boolean;
  /** Layout adjustment for compact contexts such as a filter toolbar. */
  style?: StyleProp<ViewStyle>;
  triggerStyle?: StyleProp<ViewStyle>;
  /** Replaces the pill frame with a custom trigger; the list it opens is the same. */
  trigger?: (open: () => void) => React.ReactNode;
}

interface MultiSelectPillBaseProps {
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
  /**
   * Replaces the pill frame with a custom trigger (an icon button in a toolbar); the modal
   * stays identical. The frame's label and margins are skipped - the caller lays out.
   */
  trigger?: (open: () => void) => React.ReactNode;
}

/**
 * What the pill lists is `options` (a flat list in one modal - a handful of tags, say) or `groups` (the
 * type first, then the entity - hundreds of options of different types): see `SelectSource`.
 */
export type MultiSelectPillProps = MultiSelectPillBaseProps & SelectSource;

/**
 * The trigger of a selector: a field that shows the selection and opens a `SelectModal`. It owns only
 * what the field needs - whether the modal is open and how the selection reads. The list, the search and
 * the groups are the modal's; a picker that opens from somewhere else uses `SelectModal` itself.
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
  trigger,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);

  const source = useMemo<SelectSource>(
    () => (groups ? { groups } : { options: options ?? [] }),
    [groups, options],
  );

  const optionsByValue = useMemo(() => {
    const map = new Map<string, MultiSelectOption>();
    for (const group of groupsOf(source)) {
      for (const option of group.options) {
        map.set(option.value, option);
      }
    }
    return map;
  }, [source]);

  const selectedOptionDetails = useMemo(
    () =>
      (singleSelect ? selectedValues.slice(0, 1) : selectedValues)
        .map((value) => optionsByValue.get(value))
        .filter(Boolean) as MultiSelectOption[],
    [selectedValues, optionsByValue, singleSelect],
  );

  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);
  const singleValueAppearance = singleSelect || maxSelections === 1;

  const styles = useThemedStyles(createStyles);

  return (
    <View style={trigger ? style : [styles.container, style]}>
      {!trigger && label && <Text style={styles.label}>{label}</Text>}
      {trigger ? (
        trigger(disabled ? () => undefined : openModal)
      ) : (
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
          <View
            testID="multiselect-trigger-content"
            style={[styles.triggerContent, singleValueAppearance && styles.singleValueContent]}
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
          </View>
          <View testID="multiselect-trigger-icon" style={styles.triggerIcon}>
            <Ionicons
              name={singleValueAppearance ? 'chevron-down' : 'add-circle'}
              size={24}
              color={colors.primary}
            />
          </View>
        </TouchableOpacity>
      )}

      <SelectModal
        visible={modalVisible}
        onClose={closeModal}
        source={source}
        selectedValues={selectedValues}
        onSelectionChange={onSelectionChange}
        title={label || placeholder || t('select_tags')}
        singleSelect={singleSelect}
        allowDeselect={allowDeselect}
        maxSelections={maxSelections}
        noOptionsText={noOptionsText}
        searchPlaceholder={searchPlaceholder}
      />
    </View>
  );
};

export const SingleSelectPill: React.FC<SingleSelectPillProps> = ({
  options,
  value,
  onValueChange,
  placeholder,
  label,
  noOptionsText,
  searchPlaceholder,
  disabled,
  allowDeselect = false,
  style,
  triggerStyle,
  trigger,
}) => (
  <MultiSelectPill
    options={options.map((option) => ({ ...option, color: option.color ?? undefined }))}
    selectedValues={value ? [value] : []}
    onSelectionChange={(values) => onValueChange(values[0] ?? null)}
    placeholder={placeholder}
    label={label}
    noOptionsText={noOptionsText}
    searchPlaceholder={searchPlaceholder}
    singleSelect
    allowDeselect={allowDeselect}
    disabled={disabled}
    style={style}
    triggerStyle={triggerStyle}
    trigger={trigger}
  />
);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginBottom: 10,
    },
    label: {
      ...typography.sectionTitle,
      color: colors.text,
      marginBottom: 5,
    },
    pillContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 10,
      minHeight: 50,
      borderColor: colors.primary,
      borderWidth: 1,
    },
    /*
     * Pills wrap here; the trailing icon stays outside this box. Putting `flexWrap` and
     * `marginLeft: 'auto'` on the same row made the icon drop to a second line when a pill
     * appeared, which grew the field a few pixels (relation map / boards toolbars).
     */
    triggerContent: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      minWidth: 0,
      // Spacing between pills belongs to this wrap box, not to each pill (a per-pill margin still
      // charged the last item and made the field grow when the first option was chosen).
      gap: 8,
    },
    singleValueContent: {
      flexWrap: 'nowrap',
    },
    singleValueContainer: {
      borderRadius: 5,
    },
    triggerIcon: {
      width: 24,
      height: 24,
      marginLeft: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    singleValueText: {
      ...typography.bodyLarge,
      color: colors.text,
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
      ...typography.bodyLarge,
      color: colors.textSecondary,
    },
    selectionSummary: {
      ...typography.label,
      color: colors.text,
    },
  });

export default MultiSelectPill;
