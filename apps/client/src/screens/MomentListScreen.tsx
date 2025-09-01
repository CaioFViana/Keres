import type { CreateMomentPayload, MomentResponse, UpdateMomentPayload } from '@keres/shared'
import type { StackNavigationProp } from '@react-navigation/stack' // Added

import React, { useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper' // Added

import { createMoment, deleteMoment, getMomentsBySceneId, updateMoment } from '../api'

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

type MomentListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MomentList'>

interface MomentListScreenProps {
  token: string
  sceneId: string
  navigation: MomentListScreenNavigationProp // Added
}

export default function MomentListScreen({ token, sceneId, navigation }: MomentListScreenProps) {
  const [moments, setMoments] = useState<MomentResponse[]>([])
  const [newMomentTitle, setNewMomentTitle] = useState('')
  const [editingMoment, setEditingMoment] = useState<MomentResponse | null>(null)

  useEffect(() => {
    fetchMoments()
  }, [token, sceneId])

  const fetchMoments = async () => {
    try {
      const fetchedMoments = await getMomentsBySceneId(token, sceneId)
      setMoments(fetchedMoments)
    } catch (error: any) {
      Alert.alert('Error fetching moments', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleCreateMoment = async () => {
    if (!newMomentTitle.trim()) {
      Alert.alert('Error', 'Moment title cannot be empty.')
      return
    }
    try {
      const payload: CreateMomentPayload = {
        sceneId,
        title: newMomentTitle,
        summary: null, // Optional fields
        isFavorite: false,
        extraNotes: null,
      }
      await createMoment(token, payload)
      setNewMomentTitle('')
      fetchMoments() // Refresh list
    } catch (error: any) {
      Alert.alert('Error creating moment', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleEditMoment = (moment: MomentResponse) => {
    setEditingMoment(moment)
    setNewMomentTitle(moment.title) // Populate form with current title
  }

  const handleUpdateMoment = async () => {
    if (!editingMoment || !newMomentTitle.trim()) {
      Alert.alert('Error', 'Moment title cannot be empty.')
      return
    }
    try {
      const payload: UpdateMomentPayload = {
        id: editingMoment.id,
        title: newMomentTitle,
      }
      await updateMoment(token, payload)
      setEditingMoment(null)
      setNewMomentTitle('')
      fetchMoments() // Refresh list
    } catch (error: any) {
      Alert.alert('Error updating moment', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleDeleteMoment = async (momentId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this moment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteMoment(token, momentId)
              fetchMoments() // Refresh list
            } catch (error: any) {
              Alert.alert(
                'Error deleting moment',
                error.response?.data?.error || 'Something went wrong.',
              )
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  const renderMomentItem = ({ item }: { item: MomentResponse }) => (
    <View style={styles.momentItem}>
      <Text style={styles.momentTitle}>{item.title}</Text>
      <View style={styles.momentActions}>
        <Button mode="outlined" onPress={() => handleEditMoment(item)}>
          Edit
        </Button>
        <Button mode="outlined" onPress={() => handleDeleteMoment(item.id)} buttonColor="red">
          Delete
        </Button>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <Button mode="outlined" onPress={() => navigation.goBack()}>
        Back to Scenes
      </Button>
      <Text style={styles.header}>Moments for Scene ID: {sceneId}</Text>

      <View style={styles.form}>
        <TextInput
          label={editingMoment ? 'Edit Moment Title' : 'New Moment Title'} // Changed to label
          value={newMomentTitle}
          onChangeText={setNewMomentTitle}
          mode="outlined" // Added mode
          style={styles.input} // Keep existing style for width/margin
        />
        <Button
          mode="contained" // Added mode
          onPress={editingMoment ? handleUpdateMoment : handleCreateMoment}
          style={styles.button} // Added style
        >
          {editingMoment ? 'Update Moment' : 'Add Moment'}
        </Button>
        {editingMoment && (
          <Button
            mode="outlined" // Added mode
            onPress={() => setEditingMoment(null)}
            style={styles.button} // Added style
          >
            Cancel Edit
          </Button>
        )}
      </View>

      {moments.length === 0 ? (
        <Text>No moments found. Add a new one!</Text>
      ) : (
        <FlatList
          data={moments}
          renderItem={renderMomentItem}
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
  momentItem: {
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
  momentTitle: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  momentActions: {
    flexDirection: 'row',
    gap: 10,
  },
})
