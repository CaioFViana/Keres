import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useFormScrollBottomPadding } from '../../../hooks/useFormScrollBottomPadding';
import { KeyboardHandledContext, useKeyboardOverlap } from '../../../hooks/useKeyboardOverlap';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { useTheme } from '../../../theme';
import { radius, space } from '../../../theme/tokens';

/** The padding of the surface: one of a few steps, instead of a number chosen by each modal. */
export type ModalInset = 'none' | 'compact' | 'regular' | 'roomy' | 'sheet';

const INSETS: Record<ModalInset, ViewStyle> = {
  none: {},
  compact: { padding: space.lg },
  regular: { padding: space.xl },
  roomy: { padding: space.xxl },
  sheet: {
    paddingHorizontal: space.xxl,
    paddingTop: space.xl,
    paddingBottom: space.xxl,
  },
};

interface ResponsiveModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Padding of the surface; leave it out when the content lays itself out edge to edge. */
  inset?: ModalInset;
  /** `raised` paints the surface one step above the screen (`colors.surface`), as a sheet over the content. */
  tone?: 'default' | 'raised';
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
  inset = 'none',
  tone = 'default',
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
  const {
    ref: overlayRef,
    overlap: keyboardOverlap,
    onLayout: measureOverlay,
  } = useKeyboardOverlap(visible && keyboardAvoiding);
  const resolvedPlacement = placement === 'adaptive' ? (isWide ? 'side' : 'bottom') : placement;
  const placementStyle: ViewStyle =
    resolvedPlacement === 'bottom'
      ? {
          width: '100%',
          maxWidth: 1100,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
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
        <Pressable
          testID="responsive-modal-backdrop"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          style={[
            styles.content,
            {
              backgroundColor: tone === 'raised' ? colors.surface : colors.background,
              maxHeight,
              ...placementStyle,
              ...INSETS[inset],
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
    borderRadius: radius.xl,
    overflow: 'hidden',
    // The space left above the keyboard is what the surface gets, not what its content asks for.
    flexShrink: 1,
  },
});

export default ResponsiveModal;
