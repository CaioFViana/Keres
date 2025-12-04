import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterSelect } from '../../db/schema';
import { useTheme } from '../../theme'; // Adjust path as needed

interface CharacterListItemProps {
  character: CharacterSelect;
}

const CharacterListItem: React.FC<CharacterListItemProps> = ({ character }) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
      marginVertical: 4,
      borderRadius: 8,
    },
    name: {
      color: colors.text,
      fontSize: 18,
      fontWeight: 'bold',
    },
    description: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 4,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{character.name}</Text>
      {character.description && <Text style={styles.description}>{character.description}</Text>}
    </View>
  );
};

export default CharacterListItem;
