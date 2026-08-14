import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../../theme';
import { getContrastTextColor } from '../../../../utils/colorUtils';

interface MultiSelectPillProps {
  options: { label: string; value: string; color?: string }[];
  selectedValues: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
  noOptionsText?: string;
  /** Ajustes de layout para contextos compactos, como barras de filtro. */
  style?: StyleProp<ViewStyle>;
  triggerStyle?: StyleProp<ViewStyle>;
  pillStyle?: StyleProp<ViewStyle>;
}

const MultiSelectPill: React.FC<MultiSelectPillProps> = ({
  options,
  selectedValues,
  onSelectionChange,
  placeholder,
  label,
  noOptionsText,
  style,
  triggerStyle,
  pillStyle,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const [modalVisible, setModalVisible] = useState(false);
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  const getOptionByValue = useCallback(
    (value: string) => {
      return options.find((opt) => opt.value === value);
    },
    [options],
  );

  const selectedOptionDetails = useMemo(() => {
    return selectedValues.map((value) => getOptionByValue(value)).filter(Boolean) as {
      label: string;
      value: string;
      color?: string;
    }[]; // Explicit cast
  }, [selectedValues, getOptionByValue]);

  const toggleOption = useCallback(
    (value: string) => {
      const newSelection = selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value];
      onSelectionChange(newSelection);
    },
    [selectedValues, onSelectionChange],
  );

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
    }).start(() => setModalVisible(false));
  }, [dropdownAnim]);

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
      fontSize: 16,
    },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: 15,
      padding: 5,
      marginLeft: 'auto',
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
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      padding: 5,
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
    noOptionsText: {
      padding: 15,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity onPress={openModal} style={[styles.pillContainer, triggerStyle]}>
        {selectedOptionDetails.length > 0 ? (
          selectedOptionDetails.map((option, index) => {
            const pillBackgroundColor = option.color || colors.primaryContainer;
            const pillTextColor = getContrastTextColor(pillBackgroundColor);
            return (
              <View
                key={option.value}
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
          name="add-circle"
          size={24}
          color={colors.primary}
          style={{ marginLeft: 'auto' }}
        />
      </TouchableOpacity>

      <ResponsiveModal
        visible={modalVisible}
        onClose={closeModal}
        contentStyle={styles.modalContent}
        maxHeight={Math.min(screenHeight * 0.78, 720)}
      >
        <Animated.View
          style={{
            transform: [
              {
                translateY: dropdownAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [screenHeight, 0],
                }),
              },
            ],
          }}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label || t('select_tags')}</Text>
            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {options.length > 0 ? (
              options.map((option) =>
                (() => {
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={styles.optionContainer}
                      onPress={() => toggleOption(option.value)}
                    >
                      <View style={styles.optionLeading}>
                        <View
                          style={[
                            styles.optionColor,
                            { backgroundColor: option.color || colors.primaryContainer },
                          ]}
                        />
                        <Text style={styles.optionText}>{option.label}</Text>
                      </View>
                      {selectedValues.includes(option.value) && (
                        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })(),
              )
            ) : (
              <Text style={styles.noOptionsText}>{noOptionsText || t('no_tags_available')}</Text>
            )}
          </ScrollView>
        </Animated.View>
      </ResponsiveModal>
    </View>
  );
};

export default MultiSelectPill;
