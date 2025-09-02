import type { CreateGalleryPayload, GalleryResponse, UpdateGalleryPayload } from '@keres/shared'
import type { StackNavigationProp } from '@react-navigation/stack' // Added

import React, { useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper' // Added

import { createGallery, deleteGallery, getGalleriesByStoryId, updateGallery } from '../api'

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

type GalleryListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'GalleryList'>

interface GalleryListScreenProps {
  token: string
  storyId: string
  navigation: GalleryListScreenNavigationProp // Added
}

export default function GalleryListScreen({ token, storyId, navigation }: GalleryListScreenProps) {
  const [galleries, setGalleries] = useState<GalleryResponse[]>([])
  const [newGalleryName, setNewGalleryName] = useState('')
  const [editingGallery, setEditingGallery] = useState<GalleryResponse | null>(null)

  useEffect(() => {
    fetchGalleries()
  }, [token, storyId])

  const fetchGalleries = async () => {
    try {
      const fetchedGalleries = await getGalleriesByStoryId(token, storyId)
      setGalleries(fetchedGalleries)
    } catch (error: any) {
      Alert.alert(
        'Error fetching galleries',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleCreateGallery = async () => {
    if (!newGalleryName.trim()) {
      Alert.alert('Error', 'Gallery name cannot be empty.')
      return
    }
    try {
      const payload: CreateGalleryPayload = {
        storyId,
        name: newGalleryName,
        description: null, // Optional fields
        isFavorite: false,
        extraNotes: null,
      }
      await createGallery(token, payload)
      setNewGalleryName('')
      fetchGalleries() // Refresh list
    } catch (error: any) {
      Alert.alert('Error creating gallery', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleEditGallery = (gallery: GalleryResponse) => {
    setEditingGallery(gallery)
    setNewGalleryName(gallery.name) // Populate form with current name
  }

  const handleUpdateGallery = async () => {
    if (!editingGallery || !newGalleryName.trim()) {
      Alert.alert('Error', 'Gallery name cannot be empty.')
      return
    }
    try {
      const payload: UpdateGalleryPayload = {
        id: editingGallery.id,
        name: newGalleryName,
      }
      await updateGallery(token, payload)
      setEditingGallery(null)
      setNewGalleryName('')
      fetchGalleries() // Refresh list
    } catch (error: any) {
      Alert.alert('Error updating gallery', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleDeleteGallery = async (galleryId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this gallery?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteGallery(token, galleryId)
              fetchGalleries() // Refresh list
            } catch (error: any) {
              Alert.alert(
                'Error deleting gallery',
                error.response?.data?.error || 'Something went wrong.',
              )
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  const renderGalleryItem = ({ item }: { item: GalleryResponse }) => (
    <View style={styles.galleryItem}>
      <Text style={styles.galleryName}>{item.name}</Text>
      <View style={styles.galleryActions}>
        <Button mode='outlined' onPress={() => handleEditGallery(item)}>
          Edit
        </Button>
        <Button mode='outlined' onPress={() => handleDeleteGallery(item.id)} buttonColor='red'>
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
      <Text style={styles.header}>Galleries for Story ID: {storyId}</Text>

      <View style={styles.form}>
        <TextInput
          label={editingGallery ? 'Edit Gallery Name' : 'New Gallery Name'} // Changed to label
          value={newGalleryName}
          onChangeText={setNewGalleryName}
          mode='outlined' // Added mode
          style={styles.input} // Keep existing style for width/margin
        />
        <Button
          mode='contained' // Added mode
          onPress={editingGallery ? handleUpdateGallery : handleCreateGallery}
          style={styles.button} // Added style
        >
          {editingGallery ? 'Update Gallery' : 'Add Gallery'}
        </Button>
        {editingGallery && (
          <Button
            mode='outlined' // Added mode
            onPress={() => setEditingGallery(null)}
            style={styles.button} // Added style
          >
            Cancel Edit
          </Button>
        )}
      </View>

      {galleries.length === 0 ? (
        <Text>No galleries found. Add a new one!</Text>
      ) : (
        <FlatList
          data={galleries}
          renderItem={renderGalleryItem}
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
  galleryItem: {
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
  galleryName: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  galleryActions: {
    flexDirection: 'row',
    gap: 10,
  },
})
