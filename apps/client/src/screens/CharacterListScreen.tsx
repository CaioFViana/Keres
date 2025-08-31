import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Button, Alert, TextInput } from 'react-native';
import { getCharactersByStoryId, createCharacter, updateCharacter, deleteCharacter } from '../api';
import { CharacterResponse, CreateCharacterPayload, UpdateCharacterPayload } from '@keres/shared';

interface CharacterListScreenProps {
  token: string;
  storyId: string;
  onBack: () => void;
}

export default function CharacterListScreen({ token, storyId, onBack }: CharacterListScreenProps) {
  const [characters, setCharacters] = useState<CharacterResponse[]>([]);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [editingCharacter, setEditingCharacter] = useState<CharacterResponse | null>(null);

  useEffect(() => {
    fetchCharacters();
  }, [token, storyId]);

  const fetchCharacters = async () => {
    try {
      const fetchedCharacters = await getCharactersByStoryId(token, storyId);
      setCharacters(fetchedCharacters);
    } catch (error: any) {
      Alert.alert('Error fetching characters', error.response?.data?.error || 'Something went wrong.');
    }
  };

  const handleCreateCharacter = async () => {
    if (!newCharacterName.trim()) {
      Alert.alert('Error', 'Character name cannot be empty.');
      return;
    }
    try {
      const payload: CreateCharacterPayload = {
        storyId,
        name: newCharacterName,
        gender: null, // Optional fields
        race: null,
        subrace: null,
        personality: null,
        motivation: null,
        qualities: null,
        weaknesses: null,
        biography: null,
        plannedTimeline: null,
        isFavorite: false,
        extraNotes: null,
      };
      await createCharacter(token, payload);
      setNewCharacterName('');
      fetchCharacters(); // Refresh list
    } catch (error: any) {
      Alert.alert('Error creating character', error.response?.data?.error || 'Something went wrong.');
    }
  };

  const handleEditCharacter = (character: CharacterResponse) => {
    setEditingCharacter(character);
    setNewCharacterName(character.name);
  };

  const handleUpdateCharacter = async () => {
    if (!editingCharacter || !newCharacterName.trim()) {
      Alert.alert('Error', 'Character name cannot be empty.');
      return;
    }
    try {
      const payload: UpdateCharacterPayload = {
        id: editingCharacter.id,
        name: newCharacterName,
      };
      await updateCharacter(token, payload);
      setEditingCharacter(null);
      setNewCharacterName('');
      fetchCharacters(); // Refresh list
    } catch (error: any) {
      Alert.alert('Error updating character', error.response?.data?.error || 'Something went wrong.');
    }
  };

  const handleDeleteCharacter = async (characterId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this character?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteCharacter(token, characterId);
              fetchCharacters(); // Refresh list
            } catch (error: any) {
              Alert.alert('Error deleting character', error.response?.data?.error || 'Something went wrong.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const renderCharacterItem = ({ item }: { item: CharacterResponse }) => (
    <View style={styles.characterItem}>
      <Text style={styles.characterName}>{item.name}</Text>
      <View style={styles.characterActions}>
        <Button title="Edit" onPress={() => handleEditCharacter(item)} />
        <Button title="Delete" onPress={() => handleDeleteCharacter(item.id)} color="red" />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Button title="Back to Stories" onPress={onBack} />
      <Text style={styles.header}>Characters for Story ID: {storyId}</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder={editingCharacter ? 'Edit Character Name' : 'New Character Name'}
          value={newCharacterName}
          onChangeText={setNewCharacterName}
        />
        <Button
          title={editingCharacter ? 'Update Character' : 'Add Character'}
          onPress={editingCharacter ? handleUpdateCharacter : handleCreateCharacter}
        />
        {editingCharacter && (
          <Button title="Cancel Edit" onPress={() => setEditingCharacter(null)} color="gray" />
        )}
      </View>

      {characters.length === 0 ? (
        <Text>No characters found. Add a new one!</Text>
      ) : (
        <FlatList
          data={characters}
          renderItem={renderCharacterItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  form: {
    width: '100%',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  list: {
    width: '100%',
  },
  characterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  characterName: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  characterActions: {
    flexDirection: 'row',
    gap: 10,
  },
});