import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNotificationStore } from '../state/notificationStore';
import { useTheme } from '../theme';

const { width } = Dimensions.get('window');

const NotificationPopup = () => {
  const { colors } = useTheme();
  const { message, type, isVisible, hideNotification } = useNotificationStore();
  const slideAnim = useRef(new Animated.Value(width)).current; // Initial position off-screen right
  const progressBarAnim = useRef(new Animated.Value(0)).current; // Initial progress bar width (0 to 1 for percentage)

  useEffect(() => {
    if (isVisible) {
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
      ]).start(() => {
        // Auto-hide after 5 seconds (this will be handled by progressBarAnim completion if we make the timeout depend on it)
        // For now, keep the setTimeout, but we can refine this later if needed.
        setTimeout(() => {
          Animated.timing(slideAnim, {
            toValue: width, // Slide out to off-screen right
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            hideNotification();
          });
        }, 2000); // 5 seconds
      });
    } else {
      // Ensure it's off-screen when not visible and reset progress bar
      slideAnim.setValue(width);
      progressBarAnim.setValue(0);
    }
  }, [isVisible, slideAnim, hideNotification, width, progressBarAnim]);

  if (!isVisible) {
    return null;
  }

  // Determine background color based on notification type
  const backgroundColor = type === 'error' ? colors.error : colors.primary;
  const textColor = colors.onPrimary; // Assuming text on primary/error background is always onPrimary

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, transform: [{ translateX: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={type === 'error' ? 'alert-circle-outline' : 'information-circle-outline'}
          size={24}
          color={textColor}
          style={styles.icon}
        />
        <Text style={[styles.message, { color: textColor }]}>
          {message}
        </Text>
        <TouchableOpacity onPress={hideNotification} style={styles.closeButton}>
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
    top: 0, // Adjust as needed, e.g., for SafeAreaView insets
    right: 0,
    width: width * 0.9, // 90% of screen width
    maxWidth: 400, // Max width for larger screens
    padding: 15,
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000, // Ensure it's above other content
    marginTop: 50, // Give some space from the top edge
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
    marginTop: 10, // Some space between message and progress bar
  },
});

export default NotificationPopup;
