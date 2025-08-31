import React, { useState, useEffect } from 'react';
import React, { useState, useEffect } from 'react'; // Ensure React and hooks are imported
import { View, Text, StyleSheet, FlatList, Button, Alert, TextInput } from 'react-native';
import { getStoriesByUserId, createStory, updateStory, deleteStory } from '../api';
import { StoryResponse, CreateStoryPayload, UpdateStoryPayload } from '@keres/shared';
import CharacterListScreen from './CharacterListScreen'; // Added

interface StoryListScreenProps {
  token: string;
  userId: string;
}

export default function StoryListScreen({ token, userId }: StoryListScreenProps) {
  const [stories, setStories] = useState<StoryResponse[]>([]);
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [editingStory, setEditingStory] = useState<StoryResponse | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null); // Added
  const [showCharacters, setShowCharacters] = useState(false); // Added

  useEffect(() => {
    fetchStories();
  }, [token, userId]);

  const fetchStories = async () => {
    try {
      const fetchedStories = await getStoriesByUserId(token, userId);
      setStories(fetchedStories);
    } catch (error: any) {
      Alert.alert('Error fetching stories', error.response?.data?.error || 'Something went wrong.');
    }
  };

  const handleCreateStory = async () => {
    if (!newStoryTitle.trim()) {
      Alert.alert('Error', 'Story title cannot be empty.');
      return;
    }
    try {
      const payload: CreateStoryPayload = {
        userId,
        title: newStoryTitle,
        summary: null, // Optional fields
        genre: null,
        language: null,
        isFavorite: false,
        extraNotes: null,
      };
      await createStory(token, payload);
      setNewStoryTitle('');
      fetchStories(); // Refresh list
    } catch (error: any) {
      Alert.alert('Error creating story', error.response?.data?.error || 'Something went wrong.');
    }
  };

  const handleEditStory = (story: StoryResponse) => {
    setEditingStory(story);
    setNewStoryTitle(story.title); // Populate form with current title
  };

  const handleUpdateStory = async () => {
    if (!editingStory || !newStoryTitle.trim()) {
      Alert.alert('Error', 'Story title cannot be empty.');
      return;
    }
    try {
      const payload: UpdateStoryPayload = {
        id: editingStory.id,
        title: newStoryTitle,
      };
      await updateStory(token, payload);
      setEditingStory(null);
      setNewStoryTitle('');
      fetchStories(); // Refresh list
    } catch (error: any) {
      Alert.alert('Error updating story', error.response?.data?.error || 'Something went wrong.');
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this story?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteStory(token, storyId);
              fetchStories(); // Refresh list
            } catch (error: any) {
              Alert.alert('Error deleting story', error.response?.data?.error || 'Something went wrong.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const renderStoryItem = ({ item }: { item: StoryResponse }) => (
    <View style={styles.storyItem}>
      <Text style={styles.storyTitle}>{item.title}</Text>
      <View style={styles.storyActions}>
        <Button title="View Characters" onPress={() => {
          setSelectedStoryId(item.id);
          setShowCharacters(true);
        }} />
        <Button title="Edit" onPress={() => handleEditStory(item)} />
        <Button title="Delete" onPress={() => handleDeleteStory(item.id)} color="red" />
      </View>
    </View>
  );

  if (showCharacters && selectedStoryId) {
    return (
      <CharacterListScreen
        token={token}
        storyId={selectedStoryId}
        onBack={() => setShowCharacters(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Stories</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder={editingStory ? 'Edit Story Title' : 'New Story Title'}
          value={newStoryTitle}
          onChangeText={setNewStoryTitle}
        />
        <Button
          title={editingStory ? 'Update Story' : 'Add Story'}
          onPress={editingStory ? handleUpdateStory : handleCreateStory}
        />
        {editingStory && (
          <Button title="Cancel Edit" onPress={() => setEditingStory(null)} color="gray" />
        )}
      </View>

      {stories.length === 0 ? (
        <Text>No stories found. Add a new one!</Text>
      ) : (
        <FlatList
          data={stories}
          renderItem={renderStoryItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  header: {
    fontSize: 28,
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
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  list: {
    width: '100%',
  },
  storyItem: {
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
  storyTitle: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  storyActions: {
    flexDirection: 'row',
    gap: 10,
  },
});