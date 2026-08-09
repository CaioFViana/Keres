import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../../theme';

interface TriStateToggleButtonProps {
  label: string;
  value: boolean | undefined; // true, false, or undefined for "any"
  onChange: (newValue: boolean | undefined) => void;
  style?: any; // For external styling
}

const TriStateToggleButton: React.FC<TriStateToggleButtonProps> = ({ label, value, onChange, style }) => {
  const { colors } = useTheme();

  const handlePress = useCallback(() => {
    if (value === undefined) {
      onChange(true); // From Any to True
    } else if (value === true) {
      onChange(false); // From True to False
    } else {
      onChange(undefined); // From False to Any
    }
  }, [value, onChange]);

  const { iconName, iconColor, backgroundColor } = useMemo(() => {
    if (value === true) {
      return {
        iconName: 'checkmark-circle' as const,
        iconColor: colors.onPrimary,
        backgroundColor: colors.primary,
      };
    } else if (value === false) {
      return {
        iconName: 'close-circle' as const,
        iconColor: colors.onPrimary,
        backgroundColor: colors.error,
      };
    } else { // undefined
      return {
        iconName: 'square-outline' as const, // Indifferent symbol
        iconColor: colors.text,
        backgroundColor: colors.card,
      };
    }
  }, [value, colors]);

  const styles = StyleSheet.create({
    buttonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: 50,
      height: 50,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    }
  });

  return (
    <TouchableOpacity
      style={[styles.buttonContainer, { backgroundColor: backgroundColor }, style]}
      onPress={handlePress}
    >
      <Ionicons name={iconName} size={20} color={iconColor} />
    </TouchableOpacity>
  );
};

export default TriStateToggleButton;
