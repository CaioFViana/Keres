import type { CreateStoryPayload, StoryResponse, UpdateStoryPayload } from '@keres/shared';
import type { StackNavigationProp } from '@react-navigation/stack'; // Added

import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper'; // Added

import { createStory, deleteStory, getStoriesByUserId, updateStory } from '../api';
import ChapterListScreen from './ChapterListScreen';
import CharacterListScreen from './CharacterListScreen';
import GalleryListScreen from './GalleryListScreen';
import LocationListScreen from './LocationListScreen';
import NoteListScreen from './NoteListScreen';
import TagListScreen from './TagListScreen';
import WorldRuleListScreen from './WorldRuleListScreen'; // Added

type RootStackParamList = {
  StoryList: undefined;
  CharacterList: { storyId: string };
  ChapterList: { storyId: string };
  SceneList: { chapterId: string };
  MomentList: { sceneId: string };
  LocationList: { storyId: string };
  GalleryList: { storyId: string };
  NoteList: { storyId: string };
  TagList: { storyId: string };
  WorldRuleList: { storyId: string };
  SuggestionList: { userId: string };
  RelationList: { storyId: string }; // Added
};

type StoryListScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'StoryList'
>;

interface StoryListScreenProps {
  token: string;
  userId: string;
  navigation: StoryListScreenNavigationProp; // Added
}

export default function StoryListScreen({ token, userId, navigation }: StoryListScreenProps) {
  const [stories, setStories] = useState<StoryResponse[]>([]);
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [editingStory, setEditingStory] = useState<StoryResponse | null>(null);

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
        <Button mode="outlined" onPress={() => { // Added mode
          navigation.navigate('CharacterList', { storyId: item.id });
        }}>
          View Characters
        </Button>
        <Button mode="outlined" onPress={() => {
          navigation.navigate('ChapterList', { storyId: item.id });
        }}>
          View Chapters
        </Button>
        <Button mode="outlined" onPress={() => {
          navigation.navigate('LocationList', { storyId: item.id });
        }}>
          View Locations
        </Button>
        <Button mode="outlined" onPress={() => {
          navigation.navigate('GalleryList', { storyId: item.id });
        }}>
          View Galleries
        </Button>
        <Button mode="outlined" onPress={() => {
          navigation.navigate('NoteList', { storyId: item.id });
        }}>
          View Notes
        </Button>
                <Button mode="outlined" onPress={() => {
          navigation.navigate('TagList', { storyId: item.id });
        }}>
          View Tags
        </Button>
        <Button mode="outlined" onPress={() => {
          navigation.navigate('WorldRuleList', { storyId: item.id });
        }}>
          View World Rules
        </Button>
        <Button mode="outlined" onPress={() => {
          navigation.navigate('RelationList', { storyId: item.id });
        }}>
          View Relations
        </Button>
        <Button mode="outlined" onPress={() => handleEditStory(item)}>
          Edit
        </Button>
        <Button mode="outlined" onPress={() => handleDeleteStory(item.id)} buttonColor="red">
          Delete
        </Button>
      </View>
    </View>
  );

  

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Stories</Text>

      <View style={styles.form}>
        <TextInput
          label={editingStory ? 'Edit Story Title' : 'New Story Title'} // Changed to label
          value={newStoryTitle}
          onChangeText={setNewStoryTitle}
          mode="outlined" // Added mode
          style={styles.input} // Keep existing style for width/margin
        />
        <Button
          mode="contained" // Added mode
          onPress={editingStory ? handleUpdateStory : handleCreateStory}
          style={styles.button} // Added style
        >
          {editingStory ? 'Update Story' : 'Add Story'}
        </Button>
        {editingStory && (
          <Button
            mode="outlined" // Added mode
            onPress={() => setEditingStory(null)}
            style={styles.button} // Added style
          >
            Cancel Edit
          </Button>
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