import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useNotificationStore } from '../state/notificationStore'; // Import the updated store

const { width } = Dimensions.get('window');

const NotificationPopup = () => {
  const { colors } = useTheme();
  // Destructure currentNotification and dequeueNotification from the store
  const { currentNotification, dequeueNotification } = useNotificationStore();
  const slideAnim = useRef(new Animated.Value(width)).current; // Initial position off-screen right
  const progressBarAnim = useRef(new Animated.Value(0)).current; // Initial progress bar width (0 to 1 for percentage)

  useEffect(() => {
    if (currentNotification) { // Check if there's a currentNotification
      // Reset progress bar animation
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
      // Auto-hide after 5 seconds
      // Using setTimeout directly after parallel animation start,
      // it ensures the hide animation starts 5 seconds AFTER the notification is fully displayed.
      // And the progressBar animation already shows the entire 5 seconds.
      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: width, // Slide out to off-screen right
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          dequeueNotification(); // Call dequeueNotification after slide-out
        });
      }, 5000); // 5 seconds

      return () => clearTimeout(timer); // Clear timeout if component unmounts or currentNotification changes
    } else {
      // Ensure it's off-screen when no current notification and reset progress bar
      slideAnim.setValue(width);
      progressBarAnim.setValue(0);
    }
  }, [currentNotification, slideAnim, dequeueNotification, width, progressBarAnim]); // Depend on currentNotification

  if (!currentNotification) { // Only render if there's a current notification
    return null;
  }

  // Determine background color based on notification type
  const backgroundColor = currentNotification.type === 'error' ? colors.error : (currentNotification.type === 'success' ? colors.primary : colors.card);
  const textColor = colors.onPrimary;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, transform: [{ translateX: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={currentNotification.type === 'error' ? 'alert-circle-outline' : 'information-circle-outline'}
          size={24}
          color={textColor}
          style={styles.icon}
        />
        <Text style={[styles.message, { color: textColor }]}>
          {currentNotification.message}
        </Text>
        <TouchableOpacity onPress={dequeueNotification} style={styles.closeButton}>
          <Ionicons name="close-circle-outline" size={20} color={textColor} />
        </TouchableOpacity>
      </View>
      <Animated.View
        style={[
          styles.progressBar,
          {
            backgroundColor: textColor, // Use textColor for the progress bar color
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
    top: 0,
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
    zIndex: 1000,
    marginTop: 50,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
  },
  closeButton: {
    marginLeft: 10,
    padding: 5,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 10,
  },
});

export default NotificationPopup;
