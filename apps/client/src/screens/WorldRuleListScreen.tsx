import type {
  CreateWorldRulePayload,
  UpdateWorldRulePayload,
  WorldRuleResponse,
} from '@keres/shared'
import type { StackNavigationProp } from '@react-navigation/stack' // Added

import React, { useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper' // Added

import { createWorldRule, deleteWorldRule, getWorldRulesByStoryId, updateWorldRule } from '../api'

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

type WorldRuleListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'WorldRuleList'>

interface WorldRuleListScreenProps {
  token: string
  storyId: string
  navigation: WorldRuleListScreenNavigationProp // Added
}

export default function WorldRuleListScreen({
  token,
  storyId,
  navigation,
}: WorldRuleListScreenProps) {
  const [worldRules, setWorldRules] = useState<WorldRuleResponse[]>([])
  const [newWorldRuleTitle, setNewWorldRuleTitle] = useState('')
  const [editingWorldRule, setEditingWorldRule] = useState<WorldRuleResponse | null>(null)

  useEffect(() => {
    fetchWorldRules()
  }, [token, storyId])

  const fetchWorldRules = async () => {
    try {
      const fetchedWorldRules = await getWorldRulesByStoryId(token, storyId)
      setWorldRules(fetchedWorldRules)
    } catch (error: any) {
      Alert.alert(
        'Error fetching world rules',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleCreateWorldRule = async () => {
    if (!newWorldRuleTitle.trim()) {
      Alert.alert('Error', 'World Rule title cannot be empty.')
      return
    }
    try {
      const payload: CreateWorldRulePayload = {
        storyId,
        title: newWorldRuleTitle,
        description: null, // Optional fields
        isFavorite: false,
        extraNotes: null,
      }
      await createWorldRule(token, payload)
      setNewWorldRuleTitle('')
      fetchWorldRules() // Refresh list
    } catch (error: any) {
      Alert.alert(
        'Error creating world rule',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleEditWorldRule = (worldRule: WorldRuleResponse) => {
    setEditingWorldRule(worldRule)
    setNewWorldRuleTitle(worldRule.title) // Populate form with current title
  }

  const handleUpdateWorldRule = async () => {
    if (!editingWorldRule || !newWorldRuleTitle.trim()) {
      Alert.alert('Error', 'World Rule title cannot be empty.')
      return
    }
    try {
      const payload: UpdateWorldRulePayload = {
        id: editingWorldRule.id,
        title: newWorldRuleTitle,
      }
      await updateWorldRule(token, payload)
      setEditingWorldRule(null)
      setNewWorldRuleTitle('')
      fetchWorldRules() // Refresh list
    } catch (error: any) {
      Alert.alert(
        'Error updating world rule',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleDeleteWorldRule = async (worldRuleId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this world rule?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteWorldRule(token, worldRuleId)
              fetchWorldRules() // Refresh list
            } catch (error: any) {
              Alert.alert(
                'Error deleting world rule',
                error.response?.data?.error || 'Something went wrong.',
              )
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  const renderWorldRuleItem = ({ item }: { item: WorldRuleResponse }) => (
    <View style={styles.worldRuleItem}>
      <Text style={styles.worldRuleTitle}>{item.title}</Text>
      <View style={styles.worldRuleActions}>
        <Button mode="outlined" onPress={() => handleEditWorldRule(item)}>
          Edit
        </Button>
        <Button mode="outlined" onPress={() => handleDeleteWorldRule(item.id)} buttonColor="red">
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
      <Text style={styles.header}>World Rules for Story ID: {storyId}</Text>

      <View style={styles.form}>
        <TextInput
          label={editingWorldRule ? 'Edit World Rule Title' : 'New World Rule Title'} // Changed to label
          value={newWorldRuleTitle}
          onChangeText={setNewWorldRuleTitle}
          mode="outlined" // Added mode
          style={styles.input} // Keep existing style for width/margin
        />
        <Button
          mode="contained" // Added mode
          onPress={editingWorldRule ? handleUpdateWorldRule : handleCreateWorldRule}
          style={styles.button} // Added style
        >
          {editingWorldRule ? 'Update World Rule' : 'Add World Rule'}
        </Button>
        {editingWorldRule && (
          <Button
            mode="outlined" // Added mode
            onPress={() => setEditingWorldRule(null)}
            style={styles.button} // Added style
          >
            Cancel Edit
          </Button>
        )}
      </View>

      {worldRules.length === 0 ? (
        <Text>No world rules found. Add a new one!</Text>
      ) : (
        <FlatList
          data={worldRules}
          renderItem={renderWorldRuleItem}
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
  worldRuleItem: {
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
  worldRuleTitle: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  worldRuleActions: {
    flexDirection: 'row',
    gap: 10,
  },
})
