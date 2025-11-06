import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../../../theme';

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const Button: React.FC<ButtonProps> = ({ onPress, children, style }) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    button: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: 'bold',
    },
  });

  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress}>
      {typeof children === 'string' ? (
        <Text style={styles.buttonText}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
};

export default Button;
