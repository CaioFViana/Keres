import React from 'react';
import { View, Text, StyleSheet, TextInput, Button, FlatList } from 'react-native';
import { useTheme } from '../theme';
import { getCommonCardStyles, saturateColor } from '../theme/commonStyles';

const MainDashboardScreen = () => {
  const { colors } = useTheme();
  const commonCardStyles = getCommonCardStyles(colors);

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
    input: {
      height: 40,
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 10,
      marginBottom: 10,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    buttonContainer: {
      marginTop: 10,
      marginBottom: 20,
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: 5,
    },
    themedText: {
      fontSize: 16,
      color: colors.primary,
      marginTop: 10,
    },
  });

  const testData = [
    { id: '1', text: 'Test Item 1' },
    { id: '2', text: 'Test Item 2' },
    { id: '3', text: 'Test Item 3' },
  ];

  const renderTestItem = ({ item }: { item: { id: string; text: string } }) => (
    <View style={commonCardStyles.cardContainer}>
      <Text style={commonCardStyles.cardText}>{item.text}</Text>
    </View>
  );

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

      <Text style={styles.themedText}>This text uses the primary theme color.</Text>

      <TextInput
        style={styles.input}
        placeholder="Test input field"
        placeholderTextColor={colors.textSecondary}
      />

      <View style={styles.buttonContainer}>
        <Button title="Test Button" color={colors.primary} onPress={() => {}} />
      </View>

      <Text style={styles.subtitle}>Test List</Text>
      <FlatList
        data={testData}
        renderItem={renderTestItem}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
};

export default MainDashboardScreen;
