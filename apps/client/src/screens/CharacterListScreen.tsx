import type {
  CharacterResponse,
  CreateCharacterPayload,
  UpdateCharacterPayload,
} from '@keres/shared'
import type { StackNavigationProp } from '@react-navigation/stack' // Added

import React, { useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper' // Added

import { createCharacter, deleteCharacter, getCharactersByStoryId, updateCharacter } from '../api'

type RootStackParamList = {
  StoryList: undefined
  CharacterList: { storyId: string }
  ChapterList: { storyId: string }
  SceneList: { chapterId: string }
  MomentList: { sceneId: string }
  LocationList: { storyId: string }
  GalleryList: { storyId: string }
  NoteList: { storyId: string }
  TagList: { storyId: string }
  WorldRuleList: { storyId: string }
  SuggestionList: { userId: string }
  CharacterMomentList: { characterId: string }
  CharacterRelationList: { characterId: string } // Added
}

type CharacterListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CharacterList'>

interface CharacterListScreenProps {
  token: string
  storyId: string
  navigation: CharacterListScreenNavigationProp // Added
}

export default function CharacterListScreen({
  token,
  storyId,
  navigation,
}: CharacterListScreenProps) {
  const [characters, setCharacters] = useState<CharacterResponse[]>([])
  const [newCharacterName, setNewCharacterName] = useState('')
  const [editingCharacter, setEditingCharacter] = useState<CharacterResponse | null>(null)

  useEffect(() => {
    fetchCharacters()
  }, [token, storyId])

  const fetchCharacters = async () => {
    try {
      const fetchedCharacters = await getCharactersByStoryId(token, storyId)
      setCharacters(fetchedCharacters)
    } catch (error: any) {
      Alert.alert(
        'Error fetching characters',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleCreateCharacter = async () => {
    if (!newCharacterName.trim()) {
      Alert.alert('Error', 'Character name cannot be empty.')
      return
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
      }
      await createCharacter(token, payload)
      setNewCharacterName('')
      fetchCharacters() // Refresh list
    } catch (error: any) {
      Alert.alert(
        'Error creating character',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleEditCharacter = (character: CharacterResponse) => {
    setEditingCharacter(character)
    setNewCharacterName(character.name)
  }

  const handleUpdateCharacter = async () => {
    if (!editingCharacter || !newCharacterName.trim()) {
      Alert.alert('Error', 'Character name cannot be empty.')
      return
    }
    try {
      const payload: UpdateCharacterPayload = {
        id: editingCharacter.id,
        name: newCharacterName,
      }
      await updateCharacter(token, payload)
      setEditingCharacter(null)
      setNewCharacterName('')
      fetchCharacters() // Refresh list
    } catch (error: any) {
      Alert.alert(
        'Error updating character',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

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
              await deleteCharacter(token, characterId)
              fetchCharacters() // Refresh list
            } catch (error: any) {
              Alert.alert(
                'Error deleting character',
                error.response?.data?.error || 'Something went wrong.',
              )
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  const renderCharacterItem = ({ item }: { item: CharacterResponse }) => (
    <View style={styles.characterItem}>
      <Text style={styles.characterName}>{item.name}</Text>
      <View style={styles.characterActions}>
        <Button mode="outlined" onPress={() => {
          navigation.navigate('CharacterMomentList', { characterId: item.id });
        }}>
          View Moments
        </Button>
        <Button mode="outlined" onPress={() => {
          navigation.navigate('CharacterRelationList', { characterId: item.id });
        }}>
          View Relations
        </Button>
        <Button mode="outlined" onPress={() => handleEditCharacter(item)}>
          Edit
        </Button>
        <Button mode="outlined" onPress={() => handleDeleteCharacter(item.id)} buttonColor="red">
          Delete
        </Button>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <Button mode="outlined" onPress={() => navigation.goBack()}>
        Back to Stories
      </Button>
      <Text style={styles.header}>Characters for Story ID: {storyId}</Text>

      <View style={styles.form}>
        <TextInput
          label={editingCharacter ? 'Edit Character Name' : 'New Character Name'} // Changed to label
          value={newCharacterName}
          onChangeText={setNewCharacterName}
          mode="outlined" // Added mode
          style={styles.input} // Keep existing style for width/margin
        />
        <Button
          mode="contained" // Added mode
          onPress={editingCharacter ? handleUpdateCharacter : handleCreateCharacter}
          style={styles.button} // Added style
        >
          {editingCharacter ? 'Update Character' : 'Add Character'}
        </Button>
        {editingCharacter && (
          <Button
            mode="outlined" // Added mode
            onPress={() => setEditingCharacter(null)}
            style={styles.button} // Added style
          >
            Cancel Edit
          </Button>
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
  )
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
    // Paper TextInput handles height and border, so remove them from here
    // height: 40,
    // borderColor: '#ddd',
    // borderWidth: 1,
    // borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  button: { // Added
    marginTop: 10,
    marginBottom: 10,
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
})
