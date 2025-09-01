import type { CreateNotePayload, NoteResponse, UpdateNotePayload } from '@keres/shared'
import type { StackNavigationProp } from '@react-navigation/stack' // Added

import React, { useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper' // Added

import { createNote, deleteNote, getNotesByStoryId, updateNote } from '../api'

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

type NoteListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'NoteList'>

interface NoteListScreenProps {
  token: string
  storyId: string
  navigation: NoteListScreenNavigationProp // Added
}

export default function NoteListScreen({ token, storyId, navigation }: NoteListScreenProps) {
  const [notes, setNotes] = useState<NoteResponse[]>([])
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [editingNote, setEditingNote] = useState<NoteResponse | null>(null)

  useEffect(() => {
    fetchNotes()
  }, [token, storyId])

  const fetchNotes = async () => {
    try {
      const fetchedNotes = await getNotesByStoryId(token, storyId)
      setNotes(fetchedNotes)
    } catch (error: any) {
      Alert.alert('Error fetching notes', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleCreateNote = async () => {
    if (!newNoteTitle.trim()) {
      Alert.alert('Error', 'Note title cannot be empty.')
      return
    }
    try {
      const payload: CreateNotePayload = {
        storyId,
        title: newNoteTitle,
        content: null, // Optional fields
        isFavorite: false,
        extraNotes: null,
      }
      await createNote(token, payload)
      setNewNoteTitle('')
      fetchNotes() // Refresh list
    } catch (error: any) {
      Alert.alert('Error creating note', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleEditNote = (note: NoteResponse) => {
    setEditingNote(note)
    setNewNoteTitle(note.title) // Populate form with current title
  }

  const handleUpdateNote = async () => {
    if (!editingNote || !newNoteTitle.trim()) {
      Alert.alert('Error', 'Note title cannot be empty.')
      return
    }
    try {
      const payload: UpdateNotePayload = {
        id: editingNote.id,
        title: newNoteTitle,
      }
      await updateNote(token, payload)
      setEditingNote(null)
      setNewNoteTitle('')
      fetchNotes() // Refresh list
    } catch (error: any) {
      Alert.alert('Error updating note', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteNote(token, noteId)
              fetchNotes() // Refresh list
            } catch (error: any) {
              Alert.alert(
                'Error deleting note',
                error.response?.data?.error || 'Something went wrong.',
              )
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  const renderNoteItem = ({ item }: { item: NoteResponse }) => (
    <View style={styles.noteItem}>
      <Text style={styles.noteTitle}>{item.title}</Text>
      <View style={styles.noteActions}>
        <Button mode="outlined" onPress={() => handleEditNote(item)}>
          Edit
        </Button>
        <Button mode="outlined" onPress={() => handleDeleteNote(item.id)} buttonColor="red">
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
      <Text style={styles.header}>Notes for Story ID: {storyId}</Text>

      <View style={styles.form}>
        <TextInput
          label={editingNote ? 'Edit Note Title' : 'New Note Title'} // Changed to label
          value={newNoteTitle}
          onChangeText={setNewNoteTitle}
          mode="outlined" // Added mode
          style={styles.input} // Keep existing style for width/margin
        />
        <Button
          mode="contained" // Added mode
          onPress={editingNote ? handleUpdateNote : handleCreateNote}
          style={styles.button} // Added style
        >
          {editingNote ? 'Update Note' : 'Add Note'}
        </Button>
        {editingNote && (
          <Button
            mode="outlined" // Added mode
            onPress={() => setEditingNote(null)}
            style={styles.button} // Added style
          >
            Cancel Edit
          </Button>
        )}
      </View>

      {notes.length === 0 ? (
        <Text>No notes found. Add a new one!</Text>
      ) : (
        <FlatList
          data={notes}
          renderItem={renderNoteItem}
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
  noteItem: {
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
  noteTitle: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  noteActions: {
    flexDirection: 'row',
    gap: 10,
  },
})
