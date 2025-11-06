import { Story } from '@keres/shared/entities/Story';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, Button, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { schema, StoryInsert, useDrizzle } from '../db'; // Import useDrizzle
import { useStoryStore } from '../state/storyStore';
import { useThemeStore } from '../state/themeStore'; // Import useThemeStore
import { useUserSettingsStore } from '../state/userSettingsStore'; // Import useUserSettingsStore
import { useTheme } from '../theme';
import { createULID } from '../utils/ulid';



type RootStackParamList = {
  ColdInstall: undefined;
  StorySelection: undefined;
  MainSystem: { storyId: string };
};


type StorySelectionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'StorySelection'>;

// Infer the insert type from the Drizzle schema

const StorySelectionScreen = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const navigation = useNavigation<StorySelectionScreenNavigationProp>();
  const { colors } = useTheme();
  // const db = useSQLiteContext(); // Removed
  const drizzleDb = useDrizzle(); // Get the Drizzle client from context
  const { setSelectedStory } = useStoryStore();

  // Get client settings from stores
  const { username, language } = useUserSettingsStore();
  const { darkMode } = useThemeStore();


  const fetchStories = async () => {
    try {
      // const drizzleDb = await getDb(); // Removed
      const result = await drizzleDb.select().from(schema.stories).all(); // Using Drizzle query builder
      setStories(result as Story[]); // Cast to Story[]
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
    const newStoryData: StoryInsert = {
      id: createULID(),
      userId: 'placeholder-user-id', // TODO: Replace with actual user ID from authStore
      title: `New Story ${stories.length + 1}`,
      type: 'linear',
      description: null,
      genre: null,
      language: 'en',
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
      serverId: null,
    };


    try {
      // const drizzleDb = await getDb(); // Removed
      await drizzleDb.insert(schema.stories).values(newStoryData).run(); // Using Drizzle query builder

      fetchStories(); // Refresh the list of stories
      // We need to create a Story object from newStoryData to pass to handleSelectStory
      const createdStory: Story = {
        ...newStoryData,
        description: newStoryData.description ?? null,
        genre: newStoryData.genre ?? null,
        language: newStoryData.language ?? null,
        extraNotes: newStoryData.extraNotes ?? null,
        deletedAt: newStoryData.deletedAt ?? null,
        serverId: newStoryData.serverId ?? null,
        createdAt: newStoryData.createdAt,
        updatedAt: newStoryData.updatedAt,
      };
      handleSelectStory(createdStory);
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
      <Text style={styles.title}>Welcome to Story Selection!</Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>
        User: {username || 'N/A'}, Language: {language || 'N/A'}, Dark Mode: {darkMode ? 'Yes' : 'No'}
      </Text>
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
