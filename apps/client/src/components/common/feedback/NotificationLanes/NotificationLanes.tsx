import React from 'react';
import { useNotificationStore } from '../../../../state/notificationStore';
import NotificationItem from '../NotificationItem/NotificationItem';

/**
 * The occupied notification lanes, without any host: no Modal, no view, no positioning of its
 * own - just the items, which are absolutely positioned and land wherever the host puts them.
 *
 * Shared on purpose. On iOS a second root-level `Modal` cannot present while another one is
 * open - both present from the same view controller (`RCTModalHostViewComponentView` presents
 * from `reactViewController`, never from the topmost presented one), so the second presentation
 * is refused and toasts fired from inside a fullscreen overlay were silently eaten. The overlays
 * therefore draw these lanes as ordinary children of their own Modal (`ThemedFullscreenModal`),
 * while the root popup stands down - see `NotificationPopup.tsx`.
 */
const NotificationLanes: React.FC = () => {
  const { currentNotifications } = useNotificationStore();

  return (
    <>
      {currentNotifications.map((notification, index) =>
        notification ? (
          <NotificationItem key={notification.id} notification={notification} laneIndex={index} />
        ) : null,
      )}
    </>
  );
};

export default NotificationLanes;
