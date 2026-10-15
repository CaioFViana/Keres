import { create } from 'zustand';

export interface AppAlertButton {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AppAlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
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
