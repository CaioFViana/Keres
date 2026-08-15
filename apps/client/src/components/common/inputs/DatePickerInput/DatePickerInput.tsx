import { formatAttributeDateForDisplay } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import DatePickerModal from '@/src/components/common/inputs/DatePickerInput/DatePickerModal';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';

interface DatePickerInputProps {
  /** Canonical `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm`, or `null`. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  style?: any;
}

/**
 * Campo de data para `AttributeType.DATE`, mesma anatomia do `ColorPickerInput`: um botão com
 * ícone abre o modal, e o campo ao lado é somente leitura.
 *
 * O que ele exibe é a data **já formatada** no idioma do app (o mesmo texto que a tela de
 * detalhe vai mostrar), não o valor canônico gravado - digitar data à mão é justamente o que
 * este picker existe para substituir. Um valor legado que não seja canônico é exibido cru, em
 * vez de sumir da tela.
 */
const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChange,
  placeholder,
  style,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const commonInputStyles = getCommonInputStyles(colors);

  const resolvedPlaceholder = placeholder || t('attribute_date_select_placeholder');
  const displayValue = value ? (formatAttributeDateForDisplay(value, i18n.language) ?? value) : '';

  const handleSelect = (nextValue: string | null) => {
    onChange(nextValue);
    setModalVisible(false);
  };

  const styles = StyleSheet.create({
    container: {
      marginBottom: 10,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.surface,
      minHeight: 50,
    },
    calendarButton: {
      width: 50,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 5,
    },
    textInput: {
      flex: 1,
      color: colors.text,
      paddingHorizontal: 10,
      borderWidth: 0,
      backgroundColor: 'transparent',
      textTransform: 'capitalize',
    },
    modalView: {
      backgroundColor: colors.background,
      borderRadius: 20,
      padding: 10,
    },
  });

  return (
    <View
      style={[
        styles.container,
        style,
        commonInputStyles.input,
        commonInputStyles.customComponentInput,
      ]}
    >
      <Pressable style={styles.inputWrapper} onPress={() => setModalVisible(true)}>
        <View style={styles.calendarButton}>
          <Ionicons name={value ? 'calendar' : 'calendar-outline'} size={20} color={colors.text} />
        </View>
        <TextInput
          style={[commonInputStyles.input, styles.textInput]}
          value={displayValue}
          placeholder={resolvedPlaceholder}
          placeholderTextColor={colors.textSecondary}
          editable={false}
          testID="date-picker-value"
        />
      </Pressable>

      <ResponsiveModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        contentStyle={styles.modalView}
        maxHeight="92%"
      >
        <DatePickerModal
          value={value}
          onSelect={handleSelect}
          onClose={() => setModalVisible(false)}
          title={resolvedPlaceholder}
        />
      </ResponsiveModal>
    </View>
  );
};

export default DatePickerInput;
