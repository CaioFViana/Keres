import { Ionicons } from '@expo/vector-icons';
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
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../../theme';
import { getContrastTextColor } from '@keres/shared';

export interface MultiSelectOption {
  label: string;
  value: string;
  color?: string;
}

export interface MultiSelectGroup {
  key: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  options: MultiSelectOption[];
}

interface MultiSelectPillProps {
  /** Lista achatada num modal só - bom para um punhado de opções (ex.: tags). */
  options?: MultiSelectOption[];
  /** Seleção em dois passos: tipo primeiro, depois a entidade - bom quando há centenas de
   * opções de tipos diferentes (ex.: o `EntityPickerInput`). Exatamente um dos dois (`options`
   * ou `groups`) deve ser passado. */
  groups?: MultiSelectGroup[];
  selectedValues: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
  noOptionsText?: string;
  /** Só aparece dentro de um grupo (achatado conta como um grupo só). */
  searchPlaceholder?: string;
  /** Limita a seleção a um valor e fecha o modal após a escolha. */
  singleSelect?: boolean;
  /** Número máximo de opções simultâneas. Opções ainda não escolhidas ficam indisponíveis. */
  maxSelections?: number;
  /** Ajustes de layout para contextos compactos, como barras de filtro. */
  style?: StyleProp<ViewStyle>;
  triggerStyle?: StyleProp<ViewStyle>;
  pillStyle?: StyleProp<ViewStyle>;
  /** Texto compacto para seleções extensas, sem perder a seleção real no modal. */
  selectionSummary?: string;
}

const FLAT_GROUP_KEY = '__flat__';

/**
 * Um único componente pra dois modos que antes eram dois componentes quase idênticos
 * (`MultiSelectPill`/`GroupedMultiSelectPill`, ~150 linhas de estilo/animação duplicadas):
 * `options` acha a lista direto num modal só; `groups` pede o tipo primeiro. Quando só há um
 * grupo (`options` achatado, ou `groups` com um item só), a etapa de escolher tipo é pulada -
 * é o mesmo caminho que o `EntityPickerInput` já usava em modo `singleSelect`.
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
  maxSelections,
  style,
  triggerStyle,
  pillStyle,
  selectionSummary,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const [modalVisible, setModalVisible] = useState(false);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const effectiveGroups = useMemo<MultiSelectGroup[]>(
    () => groups ?? [{ key: FLAT_GROUP_KEY, label: '', options: options ?? [] }],
    [groups, options],
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
    // Reseta para a lista de tipos na próxima abertura, em vez de reabrir dentro do
    // último grupo visitado.
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
        ? selectedValues.includes(value)
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
    [selectedValues, onSelectionChange, singleSelect, maxSelections, closeModal],
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
      borderColor: colors.border,
      borderWidth: 1,
      // O espaçamento entre pílulas é do contêiner, não de cada pílula. Com margem em cada
      // uma, a última ainda cobrava a margem de baixo: o campo crescia ao escolher a primeira
      // opção e a pílula ficava acima do centro, com uma sobra de 8px embaixo dela.
      gap: 8,
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
    optionText: {
      fontSize: 16,
      color: colors.text,
    },
    // Espaço do visto sempre reservado: aparecendo só quando marcado, ele empurrava a linha
    // uns pixels para baixo, e a lista inteira dançava a cada escolha.
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
        style={[styles.pillContainer, triggerStyle]}
      >
        {selectionSummary ? (
          <Text style={styles.selectionSummary}>{selectionSummary}</Text>
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
          name={singleSelect ? 'chevron-down' : 'add-circle'}
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
        <View>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              {activeGroup && effectiveGroups.length > 1 && (
                <TouchableOpacity onPress={backToGroups} style={styles.backButton}>
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                </TouchableOpacity>
              )}
              <Text style={styles.modalTitle} numberOfLines={1}>
                {activeGroup ? activeGroup.label : label || t('select_tags')}
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

          <ScrollView keyboardShouldPersistTaps="handled">
            {showGroupPicker ? (
              effectiveGroups.map((group) => {
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
                    {group.icon && (
                      <View
                        style={[
                          styles.groupIcon,
                          { backgroundColor: group.color || colors.primaryContainer },
                        ]}
                      >
                        <Ionicons
                          name={group.icon}
                          size={18}
                          color={getContrastTextColor(group.color || colors.primaryContainer)}
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
                      {option.color && (
                        <View style={[styles.optionColor, { backgroundColor: option.color }]} />
                      )}
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

export default MultiSelectPill;
