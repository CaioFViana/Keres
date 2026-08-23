import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useTheme } from '../../../theme';

interface ThemedFullscreenModalProps {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
}

/** Full-screen native modal whose transition surface always follows the active app theme. */
const ThemedFullscreenModal: React.FC<ThemedFullscreenModalProps> = ({
  visible,
  onRequestClose,
  children,
}) => {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={[styles.surface, { backgroundColor: colors.background }]}>{children}</View>
    </Modal>
  );
};

const styles = StyleSheet.create({ surface: { flex: 1 } });

export default ThemedFullscreenModal;
