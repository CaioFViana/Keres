import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';
import { getCommonInputStyles } from '../../../theme/commonStyles';
import IconPickerModal from './IconPickerModal';

interface IconPickerInputProps {
  onSelectIcon: (icon: string) => void;
  currentIcon: string | null;
  placeholder?: string;
  style?: any;
}

const IconPickerInput: React.FC<IconPickerInputProps> = ({ onSelectIcon, currentIcon, placeholder, style }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { colors } = useTheme();
  const commonInputStyles = getCommonInputStyles(colors);

  const handleSelectIcon = (icon: string) => {
    onSelectIcon(icon);
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
      paddingHorizontal: 10,
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
    centeredView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
      margin: 20,
      backgroundColor: colors.background,
      borderRadius: 20,
      padding: 35,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
  });

  return (
    <View style={[styles.container, style, commonInputStyles.input, commonInputStyles.customComponentInput]}>
      <Pressable style={styles.inputWrapper} onPress={() => setModalVisible(true)}>
        <View style={styles.iconPreview}>
          <Ionicons name={(currentIcon as keyof typeof Ionicons.glyphMap) || 'help-outline'} size={20} color={colors.text} />
        </View>
        <Text style={styles.label}>{currentIcon || placeholder}</Text>
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <IconPickerModal
              currentIcon={currentIcon}
              onSelectIcon={handleSelectIcon}
              onClose={() => setModalVisible(false)}
              title={placeholder}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default IconPickerInput;
