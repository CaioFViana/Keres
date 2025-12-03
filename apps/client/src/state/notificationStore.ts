import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationState {
  message: string;
  type: NotificationType;
  isVisible: boolean;
  showNotification: (message: string, type?: NotificationType) => void;
  hideNotification: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  message: '',
  type: 'info',
  isVisible: false,

  showNotification: (message: string, type: NotificationType = 'info') => set({
    message,
    type,
    isVisible: true,
  }),

  hideNotification: () => set({
    isVisible: false,
    message: '', // Clear message when hidden
  }),
}));
