import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';

type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry' | 'style'> & {
  /** Layout of the whole control (margins and the like); the field's own look is fixed. */
  style?: StyleProp<ViewStyle>;
};

/**
 * A field for a password: hidden while typing, with an eye on its right edge that shows it for as long
 * as the user wants to check what was typed - the same field-with-a-button-on-its-edge as
 * `SuggestionTextInput`.
 */
const PasswordInput: React.FC<PasswordInputProps> = ({ style, ...rest }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const commonInputStyles = getCommonInputStyles(colors);
  const [visible, setVisible] = useState(false);

  const styles = StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 5,
      backgroundColor: colors.surface,
      minHeight: 50,
      overflow: 'hidden',
    },
    toggle: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.primary,
      marginLeft: -1, // Overlap border
      alignSelf: 'stretch',
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        {...rest}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          commonInputStyles.input,
          {
            flex: 1,
            width: 'auto',
            borderWidth: 0,
            backgroundColor: 'transparent',
            marginBottom: 0,
          },
        ]}
        suppressInteractionBorder
      />
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setVisible((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={visible ? t('hide_password') : t('show_password')}
        accessibilityState={{ selected: visible }}
      >
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={24}
          color={colors.onPrimary}
        />
      </TouchableOpacity>
    </View>
  );
};

export default PasswordInput;
