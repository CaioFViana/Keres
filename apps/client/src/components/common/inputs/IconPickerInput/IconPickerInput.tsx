import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import IconPickerModal from '@/src/components/common/inputs/IconPickerInput/IconPickerModal';

interface IconPickerInputProps {
  onSelectIcon: (icon: string) => void;
  currentIcon: string | null;
  placeholder?: string;
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
    modalView: {
      backgroundColor: colors.background,
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
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
