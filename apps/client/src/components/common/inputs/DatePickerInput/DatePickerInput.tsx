import { formatAttributeDateForDisplay } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import DatePickerModal from '@/src/components/common/inputs/DatePickerInput/DatePickerModal';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useUserSettingsStore } from '../../../../state/userSettingsStore';
import { useTheme } from '../../../../theme';

interface DatePickerInputProps {
  /** Canonical `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm`, or `null`. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /**
   * Positioning only (margin, width). Do NOT pass `commonInputStyles.input` here: this component already
   * draws the field's frame, and a second border/height around it misaligns the inner content.
   */
  style?: any;
}

/**
 * A date field for `AttributeType.DATE`, the same anatomy as `ColorPickerInput`: a button with an icon
 * opens the modal, and the field beside it is read-only.
 *
 * What it displays is the date **already formatted** in the app's language (the same text the detail
 * screen will show), not the canonical stored value - typing a date by hand is precisely what this
 * picker exists to replace. A legacy value that is not canonical is shown raw, rather than disappearing
 * from the screen.
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
  const use24HourTime = useUserSettingsStore((state) => state.use24HourTime);

  const resolvedPlaceholder = placeholder || t('attribute_date_select_placeholder');
  const displayValue = value
    ? (formatAttributeDateForDisplay(value, i18n.language, use24HourTime) ?? value)
    : '';

  const handleSelect = (nextValue: string | null) => {
    onChange(nextValue);
    setModalVisible(false);
  };

  const styles = StyleSheet.create({
    // A single border, here. `commonInputStyles.input` is NOT applied to the container nor to the inner
    // TextInput: it already brings a border + height, and added to this wrapper's border it drew two nested
    // frames (and a box that was too tall, with `height: 50` on top of `customComponentInput`, which still
    // adds `paddingBottom: 50`).
    container: {
      marginBottom: 10,
      width: '100%',
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 5,
      backgroundColor: colors.surface,
      height: 50,
      overflow: 'hidden',
    },
    calendarButton: {
      width: 46,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    textInput: {
      flex: 1,
      height: '100%',
      color: colors.text,
      fontSize: 16,
      paddingHorizontal: 0,
      paddingRight: 10,
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
    <View style={[styles.container, style]}>
      <Pressable style={styles.inputWrapper} onPress={() => setModalVisible(true)}>
        <View style={styles.calendarButton}>
          <Ionicons name={value ? 'calendar' : 'calendar-outline'} size={20} color={colors.text} />
        </View>
        <TextInput
          style={styles.textInput}
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
