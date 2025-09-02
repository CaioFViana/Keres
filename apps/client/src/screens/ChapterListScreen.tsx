import type { ChapterResponse, CreateChapterPayload, UpdateChapterPayload } from '@keres/shared'
import type { StackNavigationProp } from '@react-navigation/stack' // Added

import React, { useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper' // Added

import { createChapter, deleteChapter, getChaptersByStoryId, updateChapter } from '../api'
import SceneListScreen from './SceneListScreen' // Added

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

type ChapterListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ChapterList'>

interface ChapterListScreenProps {
  token: string
  storyId: string
  navigation: ChapterListScreenNavigationProp // Added
}

export default function ChapterListScreen({ token, storyId, navigation }: ChapterListScreenProps) {
  const [chapters, setChapters] = useState<ChapterResponse[]>([])
  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [editingChapter, setEditingChapter] = useState<ChapterResponse | null>(null)

  useEffect(() => {
    fetchChapters()
  }, [token, storyId])

  const fetchChapters = async () => {
    try {
      const fetchedChapters = await getChaptersByStoryId(token, storyId)
      setChapters(fetchedChapters)
    } catch (error: any) {
      Alert.alert('Error fetching chapters', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleCreateChapter = async () => {
    if (!newChapterTitle.trim()) {
      Alert.alert('Error', 'Chapter title cannot be empty.')
      return
    }
    try {
      const payload: CreateChapterPayload = {
        storyId,
        title: newChapterTitle,
        summary: null, // Optional fields
        isFavorite: false,
        extraNotes: null,
      }
      await createChapter(token, payload)
      setNewChapterTitle('')
      fetchChapters() // Refresh list
    } catch (error: any) {
      Alert.alert('Error creating chapter', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleEditChapter = (chapter: ChapterResponse) => {
    setEditingChapter(chapter)
    setNewChapterTitle(chapter.title) // Populate form with current title
  }

  const handleUpdateChapter = async () => {
    if (!editingChapter || !newChapterTitle.trim()) {
      Alert.alert('Error', 'Chapter title cannot be empty.')
      return
    }
    try {
      const payload: UpdateChapterPayload = {
        id: editingChapter.id,
        title: newChapterTitle,
      }
      await updateChapter(token, payload)
      setEditingChapter(null)
      setNewChapterTitle('')
      fetchChapters() // Refresh list
    } catch (error: any) {
      Alert.alert('Error updating chapter', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleDeleteChapter = async (chapterId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this chapter?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteChapter(token, chapterId)
              fetchChapters() // Refresh list
            } catch (error: any) {
              Alert.alert(
                'Error deleting chapter',
                error.response?.data?.error || 'Something went wrong.',
              )
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  const renderChapterItem = ({ item }: { item: ChapterResponse }) => (
    <View style={styles.chapterItem}>
      <Text style={styles.chapterTitle}>{item.title}</Text>
      <View style={styles.chapterActions}>
        <Button
          mode='outlined'
          onPress={() => {
            navigation.navigate('SceneList', { chapterId: item.id })
          }}
        >
          View Scenes
        </Button>
        <Button mode='outlined' onPress={() => handleEditChapter(item)}>
          Edit
        </Button>
        <Button mode='outlined' onPress={() => handleDeleteChapter(item.id)} buttonColor='red'>
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
      <Text style={styles.header}>Chapters for Story ID: {storyId}</Text>

      <View style={styles.form}>
        <TextInput
          label={editingChapter ? 'Edit Chapter Title' : 'New Chapter Title'} // Changed to label
          value={newChapterTitle}
          onChangeText={setNewChapterTitle}
          mode='outlined' // Added mode
          style={styles.input} // Keep existing style for width/margin
        />
        <Button
          mode='contained' // Added mode
          onPress={editingChapter ? handleUpdateChapter : handleCreateChapter}
          style={styles.button} // Added style
        >
          {editingChapter ? 'Update Chapter' : 'Add Chapter'}
        </Button>
        {editingChapter && (
          <Button
            mode='outlined' // Added mode
            onPress={() => setEditingChapter(null)}
            style={styles.button} // Added style
          >
            Cancel Edit
          </Button>
        )}
      </View>

      {chapters.length === 0 ? (
        <Text>No chapters found. Add a new one!</Text>
      ) : (
        <FlatList
          data={chapters}
          renderItem={renderChapterItem}
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
  chapterItem: {
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
  chapterTitle: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  chapterActions: {
    flexDirection: 'row',
    gap: 10,
  },
})
