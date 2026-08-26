import React, { useCallback } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { AppAlertButton } from '../../../../state/appAlertStore';
import { useAppAlertStore } from '../../../../state/appAlertStore';
import { useTheme } from '../../../../theme';

/**
 * Renders what `AppAlert.alert()` asked for (see utils/AppAlert.ts). Mounted once near the
 * app's root (`App.tsx`), the same way as `NotificationPopup` - a single `Modal`, isolated from
 * the rest of the screen tree, so any screen can fire an alert without having to mount
 * anything locally.
 */
const AppAlertHost: React.FC = () => {
  const { colors } = useTheme();
  const current = useAppAlertStore((state) => state.current);
  const dismiss = useAppAlertStore((state) => state.dismiss);

  const handlePress = useCallback(
    (button: AppAlertButton) => {
      // It closes before triggering the button: the `onPress` itself often opens another alert (a deletion
      // error, for instance), which needs to replace this one, not stack on top of it.
      dismiss();
      button.onPress?.();
    },
    [dismiss],
  );

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
    },
    title: {
      fontSize: 17,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 20,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 10,
    },
    button: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      minWidth: 72,
      alignItems: 'center',
    },
    defaultButton: {
      backgroundColor: colors.primary,
    },
    cancelButton: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    destructiveButton: {
      backgroundColor: colors.error,
    },
    defaultButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: 'bold',
    },
    cancelButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: 'bold',
    },
    destructiveButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: 'bold',
    },
  });

  if (!current) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => current.cancelable && dismiss()}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => current.cancelable && dismiss()}
      >
        {/* Toque dentro do card não deve fechar o alerta - só o toque no fundo. */}
        <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{current.title}</Text>
          {!!current.message && <Text style={styles.message}>{current.message}</Text>}

          <View style={styles.buttonRow}>
            {current.buttons.map((button, index) => {
              const variantStyle =
                button.style === 'destructive'
                  ? styles.destructiveButton
                  : button.style === 'cancel'
                    ? styles.cancelButton
                    : styles.defaultButton;
              const variantTextStyle =
                button.style === 'destructive'
                  ? styles.destructiveButtonText
                  : button.style === 'cancel'
                    ? styles.cancelButtonText
                    : styles.defaultButtonText;

              return (
                <TouchableOpacity
                  key={`${button.text ?? 'button'}-${index}`}
                  style={[styles.button, variantStyle]}
                  onPress={() => handlePress(button)}
                >
                  <Text style={variantTextStyle}>{button.text || 'OK'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default AppAlertHost;
