import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Notification, useNotificationStore } from '../../../../state/notificationStore';
import { useTheme } from '../../../../theme';

const { width } = Dimensions.get('window');

interface NotificationItemProps {
  notification: Notification;
  laneIndex: number; // To determine vertical position and clear the correct lane
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, laneIndex }) => {
  const { colors } = useTheme();
  const { clearNotificationLane } = useNotificationStore();
  const slideAnim = useRef(new Animated.Value(width)).current; // Initial position off-screen right
  const progressBarAnim = useRef(new Animated.Value(0)).current; // Initial progress bar width (0 to 1 for percentage)

  useEffect(() => {
    // Reset animations
    slideAnim.setValue(width);
    progressBarAnim.setValue(0);

    // Slide in and start progress bar animation in parallel
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0, // Slide to on-screen
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(progressBarAnim, {
        toValue: 1, // Animate to 100% width
        duration: 5000, // 5 seconds
        useNativeDriver: false, // width animation cannot use native driver
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: width, // Slide out to off-screen right
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        clearNotificationLane(laneIndex); // Clear the specific lane after slide-out
      });
    }, 5000); // 5 seconds

    return () => clearTimeout(timer); // Clear timeout on unmount or if notification changes
  }, [notification.id, laneIndex, clearNotificationLane, progressBarAnim, slideAnim]); // Re-run effect if notification.id or laneIndex changes

  // Determine background color based on notification type
  const backgroundColor =
    notification.type === 'error'
      ? colors.error
      : notification.type === 'success'
        ? colors.primary
        : colors.card;
  const textColor =
    notification.type === 'error' || notification.type === 'success'
      ? colors.onPrimary
      : colors.text;

  // Calculate top position based on laneIndex
  const topPosition = 50 + laneIndex * 80; // 50 for initial top margin, 80 for height + margin of each notification

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor,
          transform: [{ translateX: slideAnim }],
          top: topPosition,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={
            notification.type === 'error' ? 'alert-circle-outline' : 'information-circle-outline'
          }
          size={24}
          color={textColor}
          style={styles.icon}
        />
        <Text style={[styles.message, { color: textColor }]}>{notification.message}</Text>
        <TouchableOpacity
          onPress={() => clearNotificationLane(laneIndex)}
          style={styles.closeButton}
        >
          <Ionicons name="close-circle-outline" size={20} color={textColor} />
        </TouchableOpacity>
      </View>
      <Animated.View
        style={[
          styles.progressBar,
          {
            backgroundColor: textColor,
            width: progressBarAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    width: width * 0.9,
    maxWidth: 400,
    padding: 15,
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000 + 3, // Ensure it's above other content and higher for each lane
    minHeight: 70, // Minimum height, but can expand
    // height: 70, // Fixed height for consistent spacing
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // Take full height
  },
  icon: {
    marginRight: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    flexWrap: 'wrap', // Allow text to wrap
  },
  closeButton: {
    marginLeft: 10,
    padding: 5,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 5, // Adjusted margin
  },
});

export default NotificationItem;
