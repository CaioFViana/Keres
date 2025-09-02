import type {
  CharacterRelationResponse,
  CreateCharacterRelationPayload,
  UpdateCharacterRelationPayload,
} from '@keres/shared'
import type { StackNavigationProp } from '@react-navigation/stack'

import React, { useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper' // Added

import {
  createCharacterRelation,
  deleteCharacterRelation,
  getCharacterRelationsByCharacterId,
  updateCharacterRelation,
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
  CharacterMomentList: { characterId: string }
  CharacterRelationList: { characterId: string } // Added
}

type CharacterRelationListScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CharacterRelationList'
>

interface CharacterRelationListScreenProps {
  token: string
  characterId: string
  navigation: CharacterRelationListScreenNavigationProp
}

export default function CharacterRelationListScreen({
  token,
  characterId,
  navigation,
}: CharacterRelationListScreenProps) {
  const [characterRelations, setCharacterRelations] = useState<CharacterRelationResponse[]>([])
  const [newCharacterRelationDescription, setNewCharacterRelationDescription] = useState('')
  const [editingCharacterRelation, setEditingCharacterRelation] =
    useState<CharacterRelationResponse | null>(null)

  useEffect(() => {
    fetchCharacterRelations()
  }, [token, characterId])

  const fetchCharacterRelations = async () => {
    try {
      const fetchedCharacterRelations = await getCharacterRelationsByCharacterId(token, characterId)
      setCharacterRelations(fetchedCharacterRelations)
    } catch (error: any) {
      Alert.alert(
        'Error fetching character relations',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleCreateCharacterRelation = async () => {
    if (!newCharacterRelationDescription.trim()) {
      Alert.alert('Error', 'Character Relation description cannot be empty.')
      return
    }
    try {
      const payload: CreateCharacterRelationPayload = {
        characterId,
        relationId: 'some-relation-id', // Placeholder, needs to be selected from a list of relations
        description: newCharacterRelationDescription,
        isFavorite: false,
        extraNotes: null,
      }
      await createCharacterRelation(token, payload)
      setNewCharacterRelationDescription('')
      fetchCharacterRelations() // Refresh list
    } catch (error: any) {
      Alert.alert(
        'Error creating character relation',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleEditCharacterRelation = (characterRelation: CharacterRelationResponse) => {
    setEditingCharacterRelation(characterRelation)
    setNewCharacterRelationDescription(characterRelation.description) // Populate form with current description
  }

  const handleUpdateCharacterRelation = async () => {
    if (!editingCharacterRelation || !newCharacterRelationDescription.trim()) {
      Alert.alert('Error', 'Character Relation description cannot be empty.')
      return
    }
    try {
      const payload: UpdateCharacterRelationPayload = {
        id: editingCharacterRelation.id,
        description: newCharacterRelationDescription,
      }
      await updateCharacterRelation(token, payload)
      setEditingCharacterRelation(null)
      setNewCharacterRelationDescription('')
      fetchCharacterRelations() // Refresh list
    } catch (error: any) {
      Alert.alert(
        'Error updating character relation',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleDeleteCharacterRelation = async (characterRelationId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this character relation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteCharacterRelation(token, characterRelationId)
              fetchCharacterRelations() // Refresh list
            } catch (error: any) {
              Alert.alert(
                'Error deleting character relation',
                error.response?.data?.error || 'Something went wrong.',
              )
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  const renderCharacterRelationItem = ({ item }: { item: CharacterRelationResponse }) => (
    <View style={styles.characterRelationItem}>
      <Text style={styles.characterRelationDescription}>{item.description}</Text>
      <View style={styles.characterRelationActions}>
        <Button mode='outlined' onPress={() => handleEditCharacterRelation(item)}>
          Edit
        </Button>
        <Button
          mode='outlined'
          onPress={() => handleDeleteCharacterRelation(item.id)}
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
      <Text style={styles.header}>Character Relations for Character ID: {characterId}</Text>

      <View style={styles.form}>
        <TextInput
          label={
            editingCharacterRelation
              ? 'Edit Character Relation Description'
              : 'New Character Relation Description'
          }
          value={newCharacterRelationDescription}
          onChangeText={setNewCharacterRelationDescription}
          mode='outlined'
          style={styles.input}
        />
        <Button
          mode='contained'
          onPress={
            editingCharacterRelation ? handleUpdateCharacterRelation : handleCreateCharacterRelation
          }
          style={styles.button}
        >
          {editingCharacterRelation ? 'Update Character Relation' : 'Add Character Relation'}
        </Button>
        {editingCharacterRelation && (
          <Button
            mode='outlined' // Added mode
            onPress={() => setEditingCharacterRelation(null)}
            style={styles.button} // Added style
          >
            Cancel Edit
          </Button>
        )}
      </View>

      {characterRelations.length === 0 ? (
        <Text>No character relations found. Add a new one!</Text>
      ) : (
        <FlatList
          data={characterRelations}
          renderItem={renderCharacterRelationItem}
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
  characterRelationItem: {
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
  characterRelationDescription: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  characterRelationActions: {
    flexDirection: 'row',
    gap: 10,
  },
})
