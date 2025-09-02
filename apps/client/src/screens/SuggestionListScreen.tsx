import type {
  CreateSuggestionPayload,
  SuggestionResponse,
  UpdateSuggestionPayload,
} from '@keres/shared'
import type { StackNavigationProp } from '@react-navigation/stack' // Added

import React, { useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper' // Added

import {
  createSuggestion,
  deleteSuggestion,
  getSuggestionsByUserId,
  updateSuggestion,
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
}

type SuggestionListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SuggestionList'>

interface SuggestionListScreenProps {
  token: string
  userId: string
  navigation: SuggestionListScreenNavigationProp // Added
}

export default function SuggestionListScreen({
  token,
  userId,
  navigation,
}: SuggestionListScreenProps) {
  const [suggestions, setSuggestions] = useState<SuggestionResponse[]>([])
  const [newSuggestionTitle, setNewSuggestionTitle] = useState('')
  const [editingSuggestion, setEditingSuggestion] = useState<SuggestionResponse | null>(null)

  useEffect(() => {
    fetchSuggestions()
  }, [token, userId])

  const fetchSuggestions = async () => {
    try {
      const fetchedSuggestions = await getSuggestionsByUserId(token, userId)
      setSuggestions(fetchedSuggestions)
    } catch (error: any) {
      Alert.alert(
        'Error fetching suggestions',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleCreateSuggestion = async () => {
    if (!newSuggestionTitle.trim()) {
      Alert.alert('Error', 'Suggestion title cannot be empty.')
      return
    }
    try {
      const payload: CreateSuggestionPayload = {
        userId,
        title: newSuggestionTitle,
        type: 'general', // Default type, can be expanded later
        content: null, // Optional fields
        isFavorite: false,
        extraNotes: null,
      }
      await createSuggestion(token, payload)
      setNewSuggestionTitle('')
      fetchSuggestions() // Refresh list
    } catch (error: any) {
      Alert.alert(
        'Error creating suggestion',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleEditSuggestion = (suggestion: SuggestionResponse) => {
    setEditingSuggestion(suggestion)
    setNewSuggestionTitle(suggestion.title) // Populate form with current title
  }

  const handleUpdateSuggestion = async () => {
    if (!editingSuggestion || !newSuggestionTitle.trim()) {
      Alert.alert('Error', 'Suggestion title cannot be empty.')
      return
    }
    try {
      const payload: UpdateSuggestionPayload = {
        id: editingSuggestion.id,
        title: newSuggestionTitle,
      }
      await updateSuggestion(token, payload)
      setEditingSuggestion(null)
      setNewSuggestionTitle('')
      fetchSuggestions() // Refresh list
    } catch (error: any) {
      Alert.alert(
        'Error updating suggestion',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleDeleteSuggestion = async (suggestionId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this suggestion?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteSuggestion(token, suggestionId)
              fetchSuggestions() // Refresh list
            } catch (error: any) {
              Alert.alert(
                'Error deleting suggestion',
                error.response?.data?.error || 'Something went wrong.',
              )
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  const renderSuggestionItem = ({ item }: { item: SuggestionResponse }) => (
    <View style={styles.suggestionItem}>
      <Text style={styles.suggestionTitle}>{item.title}</Text>
      <View style={styles.suggestionActions}>
        <Button mode='outlined' onPress={() => handleEditSuggestion(item)}>
          Edit
        </Button>
        <Button mode='outlined' onPress={() => handleDeleteSuggestion(item.id)} buttonColor='red'>
          Delete
        </Button>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <Button mode='outlined' onPress={() => navigation.goBack()}>
        Back to Stories
      </Button>
      <Text style={styles.header}>Suggestions for User ID: {userId}</Text>

      <View style={styles.form}>
        <TextInput
          label={editingSuggestion ? 'Edit Suggestion Title' : 'New Suggestion Title'} // Changed to label
          value={newSuggestionTitle}
          onChangeText={setNewSuggestionTitle}
          mode='outlined' // Added mode
          style={styles.input} // Keep existing style for width/margin
        />
        <Button
          mode='contained' // Added mode
          onPress={editingSuggestion ? handleUpdateSuggestion : handleCreateSuggestion}
          style={styles.button} // Added style
        >
          {editingSuggestion ? 'Update Suggestion' : 'Add Suggestion'}
        </Button>
        {editingSuggestion && (
          <Button
            mode='outlined' // Added mode
            onPress={() => setEditingSuggestion(null)}
            style={styles.button} // Added style
          >
            Cancel Edit
          </Button>
        )}
      </View>

      {suggestions.length === 0 ? (
        <Text>No suggestions found. Add a new one!</Text>
      ) : (
        <FlatList
          data={suggestions}
          renderItem={renderSuggestionItem}
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
  suggestionItem: {
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
  suggestionTitle: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  suggestionActions: {
    flexDirection: 'row',
    gap: 10,
  },
})
