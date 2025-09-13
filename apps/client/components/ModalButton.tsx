import React from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native'; // Import StyleProp, ViewStyle, TextStyle
import { ThemedText } from '@/components/themed-text';

interface ModalButtonProps {
  title: string;
  onPress: () => void;
  buttonStyle?: StyleProp<ViewStyle>; // Optional style for the button container
  textStyle?: StyleProp<TextStyle>;   // Optional style for the button text
}

export default function ModalButton({ title, onPress, buttonStyle, textStyle }: ModalButtonProps) {
  return (
    <Pressable style={[styles.button, buttonStyle]} onPress={onPress}><ThemedText style={[styles.textStyle, textStyle]}>{title}</ThemedText></Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    backgroundColor: '#2196F3', // Example background color
    marginTop: 15,
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
