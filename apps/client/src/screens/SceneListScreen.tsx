import type { CreateScenePayload, SceneResponse, UpdateScenePayload } from '@keres/shared'
import type { StackNavigationProp } from '@react-navigation/stack' // Added

import React, { useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper' // Added

import { createScene, deleteScene, getScenesByChapterId, updateScene } from '../api'
import MomentListScreen from './MomentListScreen' // Added

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

type SceneListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SceneList'>

interface SceneListScreenProps {
  token: string
  chapterId: string
  navigation: SceneListScreenNavigationProp // Added
}

export default function SceneListScreen({ token, chapterId, navigation }: SceneListScreenProps) {
  const [scenes, setScenes] = useState<SceneResponse[]>([])
  const [newSceneTitle, setNewSceneTitle] = useState('')
  const [editingScene, setEditingScene] = useState<SceneResponse | null>(null)

  useEffect(() => {
    fetchScenes()
  }, [token, chapterId])

  const fetchScenes = async () => {
    try {
      const fetchedScenes = await getScenesByChapterId(token, chapterId)
      setScenes(fetchedScenes)
    } catch (error: any) {
      Alert.alert('Error fetching scenes', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleCreateScene = async () => {
    if (!newSceneTitle.trim()) {
      Alert.alert('Error', 'Scene title cannot be empty.')
      return
    }
    try {
      const payload: CreateScenePayload = {
        chapterId,
        title: newSceneTitle,
        summary: null, // Optional fields
        isFavorite: false,
        extraNotes: null,
      }
      await createScene(token, payload)
      setNewSceneTitle('')
      fetchScenes() // Refresh list
    } catch (error: any) {
      Alert.alert('Error creating scene', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleEditScene = (scene: SceneResponse) => {
    setEditingScene(scene)
    setNewSceneTitle(scene.title) // Populate form with current title
  }

  const handleUpdateScene = async () => {
    if (!editingScene || !newSceneTitle.trim()) {
      Alert.alert('Error', 'Scene title cannot be empty.')
      return
    }
    try {
      const payload: UpdateScenePayload = {
        id: editingScene.id,
        title: newSceneTitle,
      }
      await updateScene(token, payload)
      setEditingScene(null)
      setNewSceneTitle('')
      fetchScenes() // Refresh list
    } catch (error: any) {
      Alert.alert('Error updating scene', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleDeleteScene = async (sceneId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this scene?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteScene(token, sceneId)
              fetchScenes() // Refresh list
            } catch (error: any) {
              Alert.alert(
                'Error deleting scene',
                error.response?.data?.error || 'Something went wrong.',
              )
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  const renderSceneItem = ({ item }: { item: SceneResponse }) => (
    <View style={styles.sceneItem}>
      <Text style={styles.sceneTitle}>{item.title}</Text>
      <View style={styles.sceneActions}>
        <Button
          mode='outlined'
          onPress={() => {
            navigation.navigate('MomentList', { sceneId: item.id })
          }}
        >
          View Moments
        </Button>
        <Button mode='outlined' onPress={() => handleEditScene(item)}>
          Edit
        </Button>
        <Button mode='outlined' onPress={() => handleDeleteScene(item.id)} buttonColor='red'>
          Delete
        </Button>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <Button mode='outlined' onPress={() => navigation.goBack()}>
        Back to Chapters
      </Button>
      <Text style={styles.header}>Scenes for Chapter ID: {chapterId}</Text>

      <View style={styles.form}>
        <TextInput
          label={editingScene ? 'Edit Scene Title' : 'New Scene Title'} // Changed to label
          value={newSceneTitle}
          onChangeText={setNewSceneTitle}
          mode='outlined' // Added mode
          style={styles.input} // Keep existing style for width/margin
        />
        <Button
          mode='contained' // Added mode
          onPress={editingScene ? handleUpdateScene : handleCreateScene}
          style={styles.button} // Added style
        >
          {editingScene ? 'Update Scene' : 'Add Scene'}
        </Button>
        {editingScene && (
          <Button
            mode='outlined' // Added mode
            onPress={() => setEditingScene(null)}
            style={styles.button} // Added style
          >
            Cancel Edit
          </Button>
        )}
      </View>

      {scenes.length === 0 ? (
        <Text>No scenes found. Add a new one!</Text>
      ) : (
        <FlatList
          data={scenes}
          renderItem={renderSceneItem}
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
  sceneItem: {
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
  sceneTitle: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  sceneActions: {
    flexDirection: 'row',
    gap: 10,
  },
})
