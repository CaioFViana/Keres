import { create } from 'zustand';
import { logger } from '@/src/utils/logging/logger';

export interface AppAlertButton {
  text?: string;
  onPress?: (value?: string) => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AppAlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

/** Presses a button: an `async` handler is not waited for, but a rejection is logged, not lost. */
export function pressAlertButton(button: AppAlertButton, value?: string): void {
  const result = button.onPress?.(value);
  if (result instanceof Promise) {
    result.catch((error) => logger.error('An alert button failed:', error));
  }
}

interface AppAlertContent {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  cancelable: boolean;
  onDismiss?: () => void;
}

interface AppAlertState {
  current: AppAlertContent | null;
  show: (
    title: string,
    message?: string,
    buttons?: AppAlertButton[],
    options?: AppAlertOptions,
  ) => void;
  /** It closes without triggering any button - a tap outside (if `cancelable`) or the Esc key. */
  dismiss: () => void;
}

export const useAppAlertStore = create<AppAlertState>((set) => ({
  current: null,

  show: (title, message, buttons, options) => {
    set({
      current: {
        title,
        message,
        // The same behaviour as the native `Alert.alert`: with no buttons declared, an "OK" that only closes.
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
        cancelable: options?.cancelable ?? true,
        onDismiss: options?.onDismiss,
      },
    });
  },

  dismiss: () => {
    set((state) => {
      state.current?.onDismiss?.();
      return { current: null };
    });
  },
}));
