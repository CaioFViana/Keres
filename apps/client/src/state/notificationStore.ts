import { create } from 'zustand';
import { createULID } from '@/src/utils/entityUtils'; // Assuming createULID is available in utils

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationState {
  currentNotifications: (Notification | null)[]; // Array to hold up to 3 active notifications
  queue: Notification[];
  showNotification: (
    message: string,
    type?: NotificationType,
    options?: { force?: boolean },
  ) => void;
  clearNotificationLane: (laneIndex: number) => void; // New action to clear a specific lane
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  currentNotifications: [null, null, null], // Initialize with 3 empty lanes
  queue: [],

  clearAll: () => set({ currentNotifications: [null, null, null], queue: [] }),

  showNotification: (
    message: string,
    type: NotificationType = 'info',
    options?: { force?: boolean },
  ) => {
    const newNotification: Notification = {
      id: createULID(),
      message,
      type,
    };

    set((state) => {
      // Avoid piling up duplicates of the same message (e.g. a persistent sync
      // failure repeating every polling interval) either currently on screen or
      // already waiting in the queue. A forced repeat (a publish retry failing
      // the same way twice) is the person's own doing, so it goes through.
      const isDuplicate = (n: Notification | null) => n?.type === type && n?.message === message;
      if (
        !options?.force &&
        (state.currentNotifications.some(isDuplicate) || state.queue.some(isDuplicate))
      ) {
        return state;
      }

      const currentNotifications = [...state.currentNotifications];
      const emptyLaneIndex = currentNotifications.findIndex((n) => n === null);

      if (emptyLaneIndex !== -1) {
        // If an empty lane is found, place the new notification there
        currentNotifications[emptyLaneIndex] = newNotification;
        return { currentNotifications };
      } else {
        // Otherwise, add to the queue
        return { queue: [...state.queue, newNotification] };
      }
    });
  },

  clearNotificationLane: (laneIndex: number) => {
    set((state) => {
      const currentNotifications = [...state.currentNotifications];
      const queue = [...state.queue];

      if (queue.length > 0) {
        // If there are items in the queue, fill the cleared lane with the next one
        const nextNotification = queue.shift(); // Remove from the front of the queue
        currentNotifications[laneIndex] = nextNotification || null; // Use || null for type safety
      } else {
        // No more notifications in the queue, just clear the lane
        currentNotifications[laneIndex] = null;
      }
      return { currentNotifications, queue };
    });
  },
}));
