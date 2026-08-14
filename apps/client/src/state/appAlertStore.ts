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
  /** Fecha sem acionar nenhum botão - toque fora (se `cancelable`) ou tecla Esc. */
  dismiss: () => void;
}

export const useAppAlertStore = create<AppAlertState>((set) => ({
  current: null,

  show: (title, message, buttons, options) => {
    set({
      current: {
        title,
        message,
        // Mesmo padrão do `Alert.alert` nativo: sem botões declarados, um "OK" que só fecha.
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
