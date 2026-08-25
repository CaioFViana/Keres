import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import IconPickerModal from '@/src/components/common/inputs/IconPickerInput/IconPickerModal';

interface IconPickerInputProps {
  onSelectIcon: (icon: string) => void;
  currentIcon: string | null;
  placeholder?: string;
  /**
   * Positioning only (margin, width). Do NOT pass `commonInputStyles.input` here: this component already
   * draws the field's frame, and a second border/height around it misaligns the inner content.
   */
  style?: any;
}

const IconPickerInput: React.FC<IconPickerInputProps> = ({
  onSelectIcon,
  currentIcon,
  placeholder,
  style,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { colors } = useTheme();

  const handleSelectIcon = (icon: string) => {
    onSelectIcon(icon);
    setModalVisible(false);
  };

  const styles = StyleSheet.create({
    // A single border. `commonInputStyles.input` does NOT go here: it already brings a border +
    // `height: 50`, and added to this wrapper's border it drew two nested frames - and taller than it
    // should be, because `customComponentInput` still adds `paddingBottom: 50`. `marginBottom: 0` like
    // `commonInputStyles.input`: the forms' vertical rhythm comes from the next label's `marginTop`, not
    // from the field.
    container: {
      marginBottom: 0,
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
      paddingHorizontal: 10,
      overflow: 'hidden',
    },
    iconPreview: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    label: {
      flex: 1,
      color: currentIcon ? colors.text : colors.textSecondary,
    },
    modalView: {
      backgroundColor: colors.background,
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
    },
  });

  return (
    <View style={[styles.container, style]}>
      <Pressable style={styles.inputWrapper} onPress={() => setModalVisible(true)}>
        <View style={styles.iconPreview}>
          <Ionicons
            name={(currentIcon as keyof typeof Ionicons.glyphMap) || 'help-outline'}
            size={20}
            color={colors.text}
          />
        </View>
        <Text style={styles.label}>{currentIcon || placeholder}</Text>
      </Pressable>

      <ResponsiveModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        contentStyle={styles.modalView}
        maxHeight="92%"
      >
        <IconPickerModal
          currentIcon={currentIcon}
          onSelectIcon={handleSelectIcon}
          onClose={() => setModalVisible(false)}
          title={placeholder}
        />
      </ResponsiveModal>
    </View>
  );
};

export default IconPickerInput;
