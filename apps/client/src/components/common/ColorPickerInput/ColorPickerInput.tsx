import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../../../theme';
import { getCommonInputStyles } from '../../../theme/commonStyles';
import ColorPickerModal from './ColorPickerModal';


interface ColorPickerInputProps {
  onSelectColor: (color: string) => void;
  currentColor: string;
  placeholder?: string;
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
  const commonInputStyles = getCommonInputStyles(colors);

  const handleSelectColor = (color: string) => {
    onSelectColor(color);
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
      minHeight: 50
    },
    colorSwatchButton: {
      width: 50,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 5,
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
      color: colors.text, // Ensure text is visible
      paddingHorizontal: 10, // Apply padding here instead of inputWrapper
      // Remove border, background, and padding from here, as inputWrapper handles it
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    centeredView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
      margin: 20,
      backgroundColor: colors.background, // Use background for modal content
      borderRadius: 20,
      padding: 35,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
  });

  return (
    <View style={[styles.container, style, commonInputStyles.input, commonInputStyles.customComponentInput]}>
      <View style={[styles.inputWrapper]}>
        <Pressable style={styles.colorSwatchButton} onPress={() => setModalVisible(true)}>
            {/* Display color palette icon */}
            <Ionicons name={currentColor ? "color-palette" : "color-palette-outline"} size={20} color={colors.text} />
        </Pressable>
        <TextInput
          style={[commonInputStyles.input, styles.textInput]}
          value={currentColor}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          editable={false}
        />
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <ColorPickerModal
              currentColor={currentColor}
              onSelectColor={handleSelectColor}
              onClose={() => setModalVisible(false)}
              title={placeholder}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ColorPickerInput;