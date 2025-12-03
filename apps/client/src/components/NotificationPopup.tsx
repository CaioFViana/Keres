import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useNotificationStore } from '../state/notificationStore';

const { width } = Dimensions.get('window');

const NotificationPopup = () => {
  const { colors } = useTheme();
  const { message, type, isVisible, hideNotification } = useNotificationStore();
  const slideAnim = useRef(new Animated.Value(width)).current; // Initial position off-screen right

  useEffect(() => {
    if (isVisible) {
      // Slide in
      Animated.timing(slideAnim, {
        toValue: 0, // Slide to on-screen
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Auto-hide after 5 seconds
        setTimeout(() => {
          Animated.timing(slideAnim, {
            toValue: width, // Slide out to off-screen right
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            hideNotification();
          });
        }, 5000); // 5 seconds
      });
    } else {
      // Ensure it's off-screen when not visible
      slideAnim.setValue(width);
    }
  }, [isVisible, slideAnim, hideNotification, width]);

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
});

export default NotificationPopup;
