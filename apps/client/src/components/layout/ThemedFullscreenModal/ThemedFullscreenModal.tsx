import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useTheme } from '../../../theme';
import NotificationLanes from '../../common/feedback/NotificationLanes/NotificationLanes';

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
      <View style={[styles.surface, { backgroundColor: colors.background }]}>
        {children}
        {/* Toasts fired from inside the overlay (a pack installed, a medium saved) draw here, as
            ordinary children - a second root-level Modal cannot present over this one on iOS, so
            the root popup stands down instead. See `NotificationLanes.tsx`. Empty lanes render
            nothing, so hosted content is untouched until a toast actually fires. */}
        <NotificationLanes />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({ surface: { flex: 1 } });

export default ThemedFullscreenModal;
