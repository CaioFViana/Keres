import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

const MainDashboardScreen = () => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 10,
      color: colors.text,
    },
    subtitle: {
      fontSize: 18,
      fontWeight: '600',
      marginTop: 15,
      marginBottom: 5,
      color: colors.text,
    },
    text: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 5,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Current Story Title</Text>
      <Text style={styles.text}>Synchronized with: My Keres Server</Text>

      <Text style={styles.subtitle}>Story Overview</Text>
      <Text style={styles.text}>Characters: 15</Text>
      <Text style={styles.text}>Locations: 8</Text>
      <Text style={styles.text}>Chapters: 5</Text>
      <Text style={styles.text}>Scenes: 30</Text>
      <Text style={styles.text}>Choices: 12 (Branching Story)</Text>

      <Text style={styles.subtitle}>Recent Activity</Text>
      <Text style={styles.text}>- Character 'Elara' updated (5 mins ago)</Text>
      <Text style={styles.text}>- New scene 'Forest Encounter' added (1 hour ago)</Text>
      <Text style={styles.text}>- Location 'Whispering Woods' modified (yesterday)</Text>
    </View>
  );
};

export default MainDashboardScreen;
