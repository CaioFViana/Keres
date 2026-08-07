import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../../theme';
import { getContrastTextColor } from '../../../utils/colorUtils';

export interface GroupedMultiSelectOption {
  label: string;
  value: string;
}

export interface GroupedMultiSelectGroup {
  key: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  options: GroupedMultiSelectOption[];
}

interface GroupedMultiSelectPillProps {
  groups: GroupedMultiSelectGroup[];
  selectedValues: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
  noOptionsText?: string;
}

const { height: screenHeight } = Dimensions.get('window');

/**
 * Seletor múltiplo em dois passos: primeiro o tipo de entidade, depois a entidade em si.
 *
 * `MultiSelectPill` lista tudo achatado num modal só; funciona bem para um punhado de
 * opções (tags), mas uma história com centenas de personagens, locais, cenas etc. viraria
 * uma lista única de rolagem infinita sem nenhuma forma de encontrar o que se procura. Aqui
 * cada grupo (tipo de entidade) é escolhido primeiro, e só então a pessoa vê a lista - já
 * filtrável por texto - daquele tipo específico.
 */
const GroupedMultiSelectPill: React.FC<GroupedMultiSelectPillProps> = ({
  groups,
  selectedValues,
  onSelectionChange,
  placeholder,
  label,
  noOptionsText,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  const optionsByValue = useMemo(() => {
    const map = new Map<string, GroupedMultiSelectOption>();
    for (const group of groups) {
      for (const option of group.options) {
        map.set(option.value, option);
      }
    }
    return map;
  }, [groups]);

  const selectedOptionDetails = useMemo(
    () => selectedValues.map((value) => optionsByValue.get(value)).filter(Boolean) as GroupedMultiSelectOption[],
    [selectedValues, optionsByValue]
  );

  const activeGroup = useMemo(
    () => groups.find((group) => group.key === activeGroupKey) || null,
    [groups, activeGroupKey]
  );

  const visibleOptions = useMemo(() => {
    if (!activeGroup) return [];
    const query = search.trim().toLowerCase();
    if (!query) return activeGroup.options;
    return activeGroup.options.filter((option) => option.label.toLowerCase().includes(query));
  }, [activeGroup, search]);

  const toggleOption = useCallback((value: string) => {
    const newSelection = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onSelectionChange(newSelection);
  }, [selectedValues, onSelectionChange]);

  const openModal = useCallback(() => {
    setModalVisible(true);
    Animated.timing(dropdownAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [dropdownAnim]);

  const closeModal = useCallback(() => {
    Animated.timing(dropdownAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      // Reseta para a lista de tipos na próxima abertura, em vez de reabrir dentro do
      // último grupo visitado.
      setActiveGroupKey(null);
      setSearch('');
    });
  }, [dropdownAnim]);

  const openGroup = useCallback((groupKey: string) => {
    setSearch('');
    setActiveGroupKey(groupKey);
  }, []);

  const backToGroups = useCallback(() => {
    setSearch('');
    setActiveGroupKey(null);
  }, []);

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
    },
    pill: {
      flexDirection: 'row',
      borderRadius: 15,
      paddingVertical: 5,
      paddingHorizontal: 10,
      marginRight: 8,
      marginBottom: 8,
      alignItems: 'center',
    },
    pillText: {
      fontSize: 14,
    },
    placeholderText: {
      color: colors.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderRadius: 10,
      width: '90%',
      maxHeight: screenHeight * 0.7,
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
    optionText: {
      fontSize: 16,
      color: colors.text,
    },
    noOptionsText: {
      padding: 15,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity onPress={openModal} style={styles.pillContainer}>
        {selectedOptionDetails.length > 0 ? (
          selectedOptionDetails.map((option) => (
            <View key={option.value} style={[styles.pill, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.pillText, { color: getContrastTextColor(colors.primaryContainer) }]}>
                {option.label}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.placeholderText}>{placeholder || t('select_tags')}</Text>
        )}
        <Ionicons name="add-circle" size={24} color={colors.primary} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      <Modal transparent visible={modalVisible} onRequestClose={closeModal} animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={closeModal} activeOpacity={1}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [
                  {
                    translateY: dropdownAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [screenHeight, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  {activeGroup && (
                    <TouchableOpacity onPress={backToGroups} style={styles.backButton}>
                      <Ionicons name="chevron-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                  )}
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {activeGroup ? activeGroup.label : (label || t('select_tags'))}
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
                  placeholder={t('search')}
                  placeholderTextColor={colors.textSecondary}
                  autoFocus
                />
              )}

              <ScrollView>
                {!activeGroup ? (
                  groups.map((group) => {
                    const selectedCount = group.options.filter((option) => selectedValues.includes(option.value)).length;
                    const disabled = group.options.length === 0;
                    return (
                      <TouchableOpacity
                        key={group.key}
                        style={[styles.groupContainer, disabled && styles.groupContainerDisabled]}
                        onPress={() => !disabled && openGroup(group.key)}
                        disabled={disabled}
                      >
                        {group.icon && (
                          <View style={[styles.groupIcon, { backgroundColor: group.color || colors.primaryContainer }]}>
                            <Ionicons name={group.icon} size={18} color={getContrastTextColor(group.color || colors.primaryContainer)} />
                          </View>
                        )}
                        <View style={styles.groupTextWrap}>
                          <Text style={styles.groupLabel}>{group.label}</Text>
                          <Text style={styles.groupCount}>
                            {selectedCount > 0
                              ? t('grouped_select_count_selected', { selected: selectedCount, total: group.options.length })
                              : t('grouped_select_count_total', { total: group.options.length })}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                    );
                  })
                ) : visibleOptions.length > 0 ? (
                  visibleOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={styles.optionContainer}
                      onPress={() => toggleOption(option.value)}
                    >
                      <Text style={styles.optionText}>{option.label}</Text>
                      {selectedValues.includes(option.value) && (
                        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noOptionsText}>{noOptionsText || t('no_tags_available')}</Text>
                )}
              </ScrollView>
            </>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default GroupedMultiSelectPill;
