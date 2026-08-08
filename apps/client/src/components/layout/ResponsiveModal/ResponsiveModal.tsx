import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { useTheme } from '../../../theme';

interface ResponsiveModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  maxHeight?: number | `${number}%`;
  placement?: 'center' | 'bottom';
}

/** Shared modal surface used by selectors, suggestions and advanced filters. */
const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  visible,
  onClose,
  children,
  contentStyle,
  maxHeight = '80%',
  placement = 'center',
}) => {
  const { colors } = useTheme();
  const { isCompact } = useResponsiveLayout();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.overlay, placement === 'bottom' && styles.bottomOverlay]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
          style={[styles.content, {
            backgroundColor: colors.background,
            width: isCompact ? '94%' : '88%',
            maxWidth: placement === 'bottom' ? 960 : 720,
            maxHeight,
            ...(placement === 'bottom' ? {
              width: '100%',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            } : {}),
          }, contentStyle]}
        >
          {children}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
  },
  bottomOverlay: {
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    padding: 0,
  },
  content: {
    borderRadius: 12,
    overflow: 'hidden',
  },
});

export default ResponsiveModal;
