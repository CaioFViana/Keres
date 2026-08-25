import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useFormScrollBottomPadding } from '../../../hooks/useFormScrollBottomPadding';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { useTheme } from '../../../theme';

interface ResponsiveModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  maxHeight?: number | `${number}%`;
  /** Desative quando o conteúdo já usa KeyboardAwareScreen para evitar ajuste duplicado. */
  keyboardAvoiding?: boolean;
  /** `adaptive` uses the bottom sheet on compact screens and a left panel on wide screens. */
  placement?: 'center' | 'bottom' | 'side' | 'adaptive';
}

/** Shared modal surface used by selectors, suggestions and advanced filters. */
const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  visible,
  onClose,
  children,
  contentStyle,
  maxHeight = '80%',
  placement = 'center',
  keyboardAvoiding = true,
}) => {
  const { colors } = useTheme();
  const { isCompact, isWide } = useResponsiveLayout();
  // Android can draw a transparent modal behind its navigation buttons. Keep the
  // surface above that measured system area for every modal placement, not only
  // screens that happen to use KeyboardAwareScreen.
  const bottomSystemInset = useFormScrollBottomPadding(0);
  const resolvedPlacement = placement === 'adaptive' ? (isWide ? 'side' : 'bottom') : placement;
  const placementStyle: ViewStyle =
    resolvedPlacement === 'bottom'
      ? {
          width: '100%',
          maxWidth: 1100,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }
      : resolvedPlacement === 'side'
        ? { width: '50%', maxWidth: 600 }
        : { width: isCompact ? '94%' : '88%', maxWidth: 720 };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.overlay,
          resolvedPlacement === 'bottom' && styles.bottomOverlay,
          resolvedPlacement === 'side' && styles.sideOverlay,
          {
            paddingBottom:
              resolvedPlacement === 'bottom' ? bottomSystemInset : Math.max(16, bottomSystemInset),
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          enabled={keyboardAvoiding}
          behavior={
            Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined
          }
          style={[
            styles.content,
            {
              backgroundColor: colors.background,
              maxHeight,
              ...placementStyle,
            },
            contentStyle,
          ]}
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
  sideOverlay: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 16,
  },
  content: {
    borderRadius: 12,
    overflow: 'hidden',
  },
});

export default ResponsiveModal;
