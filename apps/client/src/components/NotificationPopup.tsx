import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNotificationStore } from '../state/notificationStore';
import NotificationItem from './NotificationItem';

const NotificationPopup = () => {
  const { currentNotifications } = useNotificationStore();

  return (
    <View style={styles.container}>
      {currentNotifications.map((notification, index) => (
        notification ? (
          <NotificationItem
            key={notification.id}
            notification={notification}
            laneIndex={index}
          />
        ) : null
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    // We don't want to set a height here, it should be determined by its children
    // but we need to ensure it's positioned correctly over other content.
    zIndex: 1000,
    alignItems: 'flex-end', // Align notifications to the right
  },
});

export default NotificationPopup;