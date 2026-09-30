import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useFormScrollBottomPadding } from '../../../hooks/useFormScrollBottomPadding';
import { KeyboardHandledContext, useKeyboardOverlap } from '../../../hooks/useKeyboardOverlap';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { useTheme } from '../../../theme';

interface ResponsiveModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  maxHeight?: number | `${number}%`;
  /**
   * The surface lifts itself clear of the keyboard (see `useKeyboardOverlap`). Turn it off for a
   * modal with nothing to type in.
   */
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
  const { ref: overlayRef, overlap: keyboardOverlap, onLayout: measureOverlay } =
    useKeyboardOverlap(visible && keyboardAvoiding);
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
        ref={overlayRef}
        onLayout={measureOverlay}
        style={[
          styles.overlay,
          resolvedPlacement === 'bottom' && styles.bottomOverlay,
          resolvedPlacement === 'side' && styles.sideOverlay,
          {
            // The keyboard's own height already spans the system bar it sits over, so it replaces
            // the inset rather than adding to it.
            paddingBottom: Math.max(
              resolvedPlacement === 'bottom' ? bottomSystemInset : Math.max(16, bottomSystemInset),
              keyboardOverlap,
            ),
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
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
          <KeyboardHandledContext.Provider value={keyboardAvoiding}>
            {children}
          </KeyboardHandledContext.Provider>
        </View>
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
    // The space left above the keyboard is what the surface gets, not what its content asks for.
    flexShrink: 1,
  },
});

export default ResponsiveModal;
