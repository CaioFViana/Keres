import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';

interface DetailFieldProps {
  label: string;
  value: string;
  onPress?: () => void;
}

/**
 * Label-above-value display for a single field on a read-only Detail screen. Same
 * treatment for every field - short ones (gender) and long free-text ones (biography)
 * alike - so a screen doesn't need to hand-pick styling per field.
 */
const DetailField: React.FC<DetailFieldProps> = ({ label, value, onPress }) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      marginBottom: 12,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    value: {
      fontSize: 16,
      color: colors.text,
      lineHeight: 22,
    },
    linkedValue: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    linkedValueText: { color: colors.primary, flexShrink: 1 },
    linkIcon: { marginLeft: 4 },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {onPress ? (
        <TouchableOpacity style={styles.linkedValue} onPress={onPress}>
          <Text style={[styles.value, styles.linkedValueText]}>{value}</Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.primary}
            style={styles.linkIcon}
          />
        </TouchableOpacity>
      ) : (
        <Text style={styles.value}>{value}</Text>
      )}
    </View>
  );
};

export default DetailField;
