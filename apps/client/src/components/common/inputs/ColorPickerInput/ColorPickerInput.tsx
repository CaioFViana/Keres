import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../../../../theme';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import ColorPickerModal from '@/src/components/common/inputs/ColorPickerInput/ColorPickerModal';

interface ColorPickerInputProps {
  onSelectColor: (color: string) => void;
  currentColor: string;
  placeholder?: string;
  /**
   * Positioning only (margin, width). Do NOT pass `commonInputStyles.input` here: this component already
   * draws the field's frame, and a second border/height around it misaligns the inner content.
   */
  style?: any;
}

const ColorPickerInput: React.FC<ColorPickerInputProps> = ({
  onSelectColor,
  currentColor,
  placeholder,
  style,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { colors } = useTheme();

  const handleSelectColor = (color: string) => {
    onSelectColor(color);
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
      overflow: 'hidden',
    },
    colorSwatchButton: {
      width: 50,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: currentColor || colors.border,
    },
    colorSwatchInner: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.text,
    },
    textInput: {
      flex: 1,
      height: '100%',
      color: colors.text,
      fontSize: 16,
      paddingHorizontal: 10,
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    modalView: {
      backgroundColor: colors.background, // Use background for modal content
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
    },
  });

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.inputWrapper]}>
        <Pressable style={styles.colorSwatchButton} onPress={() => setModalVisible(true)}>
          {/* Display color palette icon */}
          <Ionicons
            name={currentColor ? 'color-palette' : 'color-palette-outline'}
            size={20}
            color={colors.text}
          />
        </Pressable>
        <TextInput
          style={styles.textInput}
          value={currentColor}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          editable={false}
        />
      </View>

      <ResponsiveModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        contentStyle={styles.modalView}
        maxHeight="92%"
      >
        <ColorPickerModal
          currentColor={currentColor}
          onSelectColor={handleSelectColor}
          onClose={() => setModalVisible(false)}
          title={placeholder}
        />
      </ResponsiveModal>
    </View>
  );
};

export default ColorPickerInput;
