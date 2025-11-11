import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleCardProps {
  title: string;
  children: React.ReactNode;
  initialExpanded?: boolean;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({ title, children, initialExpanded = true }) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const { colors } = useTheme();

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: 8,
      marginBottom: 10,
      overflow: 'hidden', // Ensures content doesn't overflow during animation
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 15,
      borderBottomWidth: expanded ? 1 : 0,
      borderBottomColor: colors.border,
    },
    titleText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    content: {
      padding: 15,
    },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggleExpanded} style={styles.header}>
        <Text style={styles.titleText}>{title}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={colors.text}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
};

export default CollapsibleCard;
