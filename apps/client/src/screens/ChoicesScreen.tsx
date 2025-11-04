import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';

interface Choice {
  id: string;
  scene: string;
  choiceText: string;
  nextScene: string;
}

const ChoicesScreen = () => {
  const { colors } = useTheme();

  // Placeholder data
  const choices: Choice[] = [
    { id: '1', scene: 'Forest Path', choiceText: 'Go left', nextScene: 'Hidden Glade' },
    { id: '2', scene: 'Forest Path', choiceText: 'Go right', nextScene: 'Dark Cave' },
    { id: '3', scene: 'Hidden Glade', choiceText: 'Examine altar', nextScene: 'Ancient Ritual' },
  ];

  const renderChoiceItem = ({ item }: { item: Choice }) => (
    <TouchableOpacity style={styles.choiceItem} onPress={() => console.log('View choice', item.id)}>
      <Text style={styles.choiceText}>From: {item.scene}</Text>
      <Text style={styles.choiceText}>Choice: {item.choiceText}</Text>
      <Text style={styles.choiceText}>To: {item.nextScene}</Text>
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: colors.text,
    },
    choiceItem: {
      padding: 15,
      backgroundColor: colors.card,
      borderRadius: 8,
      marginBottom: 10,
    },
    choiceText: {
      fontSize: 16,
      color: colors.text,
    },
    graphPlaceholder: {
      marginTop: 20,
      padding: 20,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      height: 200,
    },
    graphPlaceholderText: {
      color: colors.textSecondary,
      fontSize: 16,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Story Choices</Text>
      <FlatList
        data={choices}
        renderItem={renderChoiceItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No choices defined for this story.</Text>}
      />
      <View style={styles.graphPlaceholder}>
        <Text style={styles.graphPlaceholderText}>
          Graph visualization of choices will be implemented here.
        </Text>
      </View>
    </View>
  );
};

export default ChoicesScreen;
