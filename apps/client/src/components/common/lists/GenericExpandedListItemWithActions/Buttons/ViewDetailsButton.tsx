import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../../../theme';

interface ViewDetailsButtonProps {
  onPress: () => void;
  size?: number;
  color?: string;
}

const ViewDetailsButton: React.FC<ViewDetailsButtonProps> = ({ onPress, size = 24, color }) => {
  const { colors } = useTheme();
  const iconColor = color || colors.primary;

  return (
    <TouchableOpacity
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={styles.button}
    >
      <MaterialCommunityIcons name="eye" size={size} color={iconColor} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 5,
    marginRight: 5,
  },
});

export default ViewDetailsButton;
