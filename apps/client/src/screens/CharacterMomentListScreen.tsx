import type {
  CharacterMomentResponse,
  CreateCharacterMomentPayload,
  UpdateCharacterMomentPayload,
} from '@keres/shared'
import type { StackNavigationProp } from '@react-navigation/stack'

import React, { useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper' // Added

import {
  createCharacterMoment,
  deleteCharacterMoment,
  getCharacterMomentsByCharacterId,
  updateCharacterMoment,
} from '../api'

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
  CharacterMomentList: { characterId: string } // Added
}

type CharacterMomentListScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CharacterMomentList'
>

interface CharacterMomentListScreenProps {
  token: string
  characterId: string
  navigation: CharacterMomentListScreenNavigationProp
}

export default function CharacterMomentListScreen({
  token,
  characterId,
  navigation,
}: CharacterMomentListScreenProps) {
  const [characterMoments, setCharacterMoments] = useState<CharacterMomentResponse[]>([])
  const [newCharacterMomentDescription, setNewCharacterMomentDescription] = useState('')
  const [editingCharacterMoment, setEditingCharacterMoment] =
    useState<CharacterMomentResponse | null>(null)

  useEffect(() => {
    fetchCharacterMoments()
  }, [token, characterId])

  const fetchCharacterMoments = async () => {
    try {
      const fetchedCharacterMoments = await getCharacterMomentsByCharacterId(token, characterId)
      setCharacterMoments(fetchedCharacterMoments)
    } catch (error: any) {
      Alert.alert(
        'Error fetching character moments',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleCreateCharacterMoment = async () => {
    if (!newCharacterMomentDescription.trim()) {
      Alert.alert('Error', 'Character Moment description cannot be empty.')
      return
    }
    try {
      const payload: CreateCharacterMomentPayload = {
        characterId,
        momentId: 'some-moment-id', // Placeholder, needs to be selected from a list of moments
        description: newCharacterMomentDescription,
        isFavorite: false,
        extraNotes: null,
      }
      await createCharacterMoment(token, payload)
      setNewCharacterMomentDescription('')
      fetchCharacterMoments() // Refresh list
    } catch (error: any) {
      Alert.alert(
        'Error creating character moment',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleEditCharacterMoment = (characterMoment: CharacterMomentResponse) => {
    setEditingCharacterMoment(characterMoment)
    setNewCharacterMomentDescription(characterMoment.description) // Populate form with current description
  }

  const handleUpdateCharacterMoment = async () => {
    if (!editingCharacterMoment || !newCharacterMomentDescription.trim()) {
      Alert.alert('Error', 'Character Moment description cannot be empty.')
      return
    }
    try {
      const payload: UpdateCharacterMomentPayload = {
        id: editingCharacterMoment.id,
        description: newCharacterMomentDescription,
      }
      await updateCharacterMoment(token, payload)
      setEditingCharacterMoment(null)
      setNewCharacterMomentDescription('')
      fetchCharacterMoments() // Refresh list
    } catch (error: any) {
      Alert.alert(
        'Error updating character moment',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleDeleteCharacterMoment = async (characterMomentId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this character moment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteCharacterMoment(token, characterMomentId)
              fetchCharacterMoments() // Refresh list
            } catch (error: any) {
              Alert.alert(
                'Error deleting character moment',
                error.response?.data?.error || 'Something went wrong.',
              )
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  const renderCharacterMomentItem = ({ item }: { item: CharacterMomentResponse }) => (
    <View style={styles.characterMomentItem}>
      <Text style={styles.characterMomentDescription}>{item.description}</Text>
      <View style={styles.characterMomentActions}>
        <Button mode='outlined' onPress={() => handleEditCharacterMoment(item)}>
          Edit
        </Button>
        <Button
          mode='outlined'
          onPress={() => handleDeleteCharacterMoment(item.id)}
          buttonColor='red'
        >
          Delete
        </Button>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <Button mode='outlined' onPress={() => navigation.goBack()}>
        Back to Character
      </Button>
      <Text style={styles.header}>Character Moments for Character ID: {characterId}</Text>

      <View style={styles.form}>
        <TextInput
          label={
            editingCharacterMoment
              ? 'Edit Character Moment Description'
              : 'New Character Moment Description'
          }
          value={newCharacterMomentDescription}
          onChangeText={setNewCharacterMomentDescription}
          mode='outlined'
          style={styles.input}
        />
        <Button
          mode='contained'
          onPress={
            editingCharacterMoment ? handleUpdateCharacterMoment : handleCreateCharacterMoment
          }
          style={styles.button}
        >
          {editingCharacterMoment ? 'Update Character Moment' : 'Add Character Moment'}
        </Button>
        {editingCharacterMoment && (
          <Button
            mode='outlined'
            onPress={() => setEditingCharacterMoment(null)}
            style={styles.button}
          >
            Cancel Edit
          </Button>
        )}
      </View>

      {characterMoments.length === 0 ? (
        <Text>No character moments found. Add a new one!</Text>
      ) : (
        <FlatList
          data={characterMoments}
          renderItem={renderCharacterMomentItem}
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
  button: {
    // Added
    marginTop: 10,
    marginBottom: 10,
  },
  list: {
    width: '100%',
  },
  characterMomentItem: {
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
  characterMomentDescription: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  characterMomentActions: {
    flexDirection: 'row',
    gap: 10,
  },
})
