import { create } from 'zustand';
import { createULID } from '../utils/ulid'; // Assuming ulid is available in utils

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationState {
  currentNotification: Notification | null;
  queue: Notification[];
  showNotification: (message: string, type?: NotificationType) => void;
  dequeueNotification: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  currentNotification: null,
  queue: [],

  showNotification: (message: string, type: NotificationType = 'info') => {
    const newNotification: Notification = {
      id: createULID(),
      message,
      type,
    };

    set((state) => {
      if (state.currentNotification === null) {
        // If no notification is currently visible, show this one
        return { currentNotification: newNotification };
      } else {
        // Otherwise, add to the queue
        return { queue: [...state.queue, newNotification] };
      }
    });
  },

  dequeueNotification: () => {
    set((state) => {
      if (state.queue.length > 0) {
        // If there are items in the queue, show the next one
        const [nextNotification, ...remainingQueue] = state.queue;
        return { currentNotification: nextNotification, queue: remainingQueue };
      } else {
        // No more notifications in the queue
        return { currentNotification: null };
      }
    });
  },
}));
