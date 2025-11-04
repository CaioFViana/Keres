import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';

interface CharacterRelation {
  id: string;
  character1: string;
  character2: string;
  relationType: string;
}

const CharacterRelationsScreen = () => {
  const { colors } = useTheme();

  // Placeholder data
  const relations: CharacterRelation[] = [
    { id: '1', character1: 'Elara', character2: 'Kael', relationType: 'Sister' },
    { id: '2', character1: 'Kael', character2: 'Lyra', relationType: 'Mentor' },
    { id: '3', character1: 'Elara', character2: 'Drako', relationType: 'Rival' },
  ];

  const renderRelationItem = ({ item }: { item: CharacterRelation }) => (
    <TouchableOpacity style={styles.relationItem} onPress={() => console.log('View relation', item.id)}>
      <Text style={styles.relationText}>{item.character1} is {item.relationType} of {item.character2}</Text>
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
    relationItem: {
      padding: 15,
      backgroundColor: colors.card,
      borderRadius: 8,
      marginBottom: 10,
    },
    relationText: {
      fontSize: 18,
      color: colors.text,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Character Relations</Text>
      <FlatList
        data={relations}
        renderItem={renderRelationItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No character relations defined.</Text>}
      />
    </View>
  );
};

export default CharacterRelationsScreen;
