import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Button, FlatList, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { useTheme } from '../theme';
import { useSQLiteContext } from 'expo-sqlite';
import { schema } from '../db';
import { sql } from 'drizzle-orm';
import { useStoryStore } from '../state/storyStore';
import { ulid } from '../utils/ulid';
import { Story } from '@keres/shared/entities/Story';

type RootStackParamList = {
  ColdInstall: undefined;
  StorySelection: undefined;
  MainSystem: { storyId: string };
};

type StorySelectionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'StorySelection'>;

const StorySelectionScreen = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const navigation = useNavigation<StorySelectionScreenNavigationProp>();
  const { colors } = useTheme();
  const db = useSQLiteContext();
  const { setSelectedStory } = useStoryStore();

  const fetchStories = async () => {
    try {
      const prepared = sql`SELECT * FROM stories;`.toSql();
      const result = await db.getAllAsync<Story>(prepared.sql, prepared.params);
      setStories(result);
    } catch (error) {
      console.error('Error fetching stories:', error);
      Alert.alert('Error', 'Failed to load stories.');
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  const handleSelectStory = (story: Story) => {
    setSelectedStory(story);
    navigation.replace('MainSystem', { storyId: story.id });
  };

  const handleCreateNewStory = async () => {
    const newStory: Story = {
      id: ulid(),
      userId: 'placeholder-user-id', // TODO: Replace with actual user ID from authStore
      title: `New Story ${stories.length + 1}`,
      type: 'linear',
      description: null,
      genre: null,
      language: 'en',
      isFavorite: false,
      extraNotes: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
      serverId: null,
    };

    try {
      const prepared = sql`INSERT INTO stories ("id", "userId", "title", "type", "description", "genre", "language", "isFavorite", "extraNotes", "createdAt", "updatedAt", "version", "isDeleted", "deletedAt", "serverId") VALUES (${newStory.id}, ${newStory.userId}, ${newStory.title}, ${newStory.type}, ${newStory.description}, ${newStory.genre}, ${newStory.language}, ${newStory.isFavorite}, ${newStory.extraNotes}, ${newStory.createdAt}, ${newStory.updatedAt}, ${newStory.version}, ${newStory.isDeleted}, ${newStory.deletedAt}, ${newStory.serverId});`.toSql();

      await db.runAsync(prepared.sql, prepared.params);
      fetchStories(); // Refresh the list of stories
      handleSelectStory(newStory);
    } catch (error) {
      console.error('Error creating new story:', error);
      Alert.alert('Error', 'Failed to create new story.');
    }
  };

  const renderStoryItem = ({ item }: { item: Story }) => (
    <TouchableOpacity style={styles.storyItem} onPress={() => handleSelectStory(item)}>
      <View>
        <Text style={styles.storyTitle}>{item.title}</Text>
        <Text style={styles.storyServer}>ID: {item.id}</Text>
      </View>
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: colors.text,
    },
    storyItem: {
      padding: 15,
      backgroundColor: colors.card,
      borderRadius: 8,
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    storyTitle: {
      fontSize: 18,
      color: colors.text,
    },
    storyServer: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    createButtonContainer: {
      marginTop: 20,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Stories</Text>
      <FlatList
        data={stories}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No stories found. Create one!</Text>}
      />
      <View style={styles.createButtonContainer}>
        <Button title="Create New Story" onPress={handleCreateNewStory} color={colors.primary} />
      </View>
    </View>
  );
};

export default StorySelectionScreen;
