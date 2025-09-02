import type { CreateTagPayload, TagResponse, UpdateTagPayload } from '@keres/shared'
import type { StackNavigationProp } from '@react-navigation/stack' // Added

import React, { useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper' // Added

import { createTag, deleteTag, getTagsByStoryId, updateTag } from '../api'

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

type TagListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TagList'>

interface TagListScreenProps {
  token: string
  storyId: string
  navigation: TagListScreenNavigationProp // Added
}

export default function TagListScreen({ token, storyId, navigation }: TagListScreenProps) {
  const [tags, setTags] = useState<TagResponse[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [editingTag, setEditingTag] = useState<TagResponse | null>(null)

  useEffect(() => {
    fetchTags()
  }, [token, storyId])

  const fetchTags = async () => {
    try {
      const fetchedTags = await getTagsByStoryId(token, storyId)
      setTags(fetchedTags)
    } catch (error: any) {
      Alert.alert('Error fetching tags', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      Alert.alert('Error', 'Tag name cannot be empty.')
      return
    }
    try {
      const payload: CreateTagPayload = {
        storyId,
        name: newTagName,
        isFavorite: false,
        extraNotes: null,
      }
      await createTag(token, payload)
      setNewTagName('')
      fetchTags() // Refresh list
    } catch (error: any) {
      Alert.alert('Error creating tag', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleEditTag = (tag: TagResponse) => {
    setEditingTag(tag)
    setNewTagName(tag.name) // Populate form with current name
  }

  const handleUpdateTag = async () => {
    if (!editingTag || !newTagName.trim()) {
      Alert.alert('Error', 'Tag name cannot be empty.')
      return
    }
    try {
      const payload: UpdateTagPayload = {
        id: editingTag.id,
        name: newTagName,
      }
      await updateTag(token, payload)
      setEditingTag(null)
      setNewTagName('')
      fetchTags() // Refresh list
    } catch (error: any) {
      Alert.alert('Error updating tag', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this tag?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteTag(token, tagId)
              fetchTags() // Refresh list
            } catch (error: any) {
              Alert.alert(
                'Error deleting tag',
                error.response?.data?.error || 'Something went wrong.',
              )
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  const renderTagItem = ({ item }: { item: TagResponse }) => (
    <View style={styles.tagItem}>
      <Text style={styles.tagName}>{item.name}</Text>
      <View style={styles.tagActions}>
        <Button mode='outlined' onPress={() => handleEditTag(item)}>
          Edit
        </Button>
        <Button mode='outlined' onPress={() => handleDeleteTag(item.id)} buttonColor='red'>
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
      <Text style={styles.header}>Tags for Story ID: {storyId}</Text>

      <View style={styles.form}>
        <TextInput
          label={editingTag ? 'Edit Tag Name' : 'New Tag Name'} // Changed to label
          value={newTagName}
          onChangeText={setNewTagName}
          mode='outlined' // Added mode
          style={styles.input} // Keep existing style for width/margin
        />
        <Button
          mode='contained' // Added mode
          onPress={editingTag ? handleUpdateTag : handleCreateTag}
          style={styles.button} // Added style
        >
          {editingTag ? 'Update Tag' : 'Add Tag'}
        </Button>
        {editingTag && (
          <Button
            mode='outlined' // Added mode
            onPress={() => setEditingTag(null)}
            style={styles.button} // Added style
          >
            Cancel Edit
          </Button>
        )}
      </View>

      {tags.length === 0 ? (
        <Text>No tags found. Add a new one!</Text>
      ) : (
        <FlatList
          data={tags}
          renderItem={renderTagItem}
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
  tagItem: {
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
  tagName: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  tagActions: {
    flexDirection: 'row',
    gap: 10,
  },
})
