import { Story } from '@keres/shared/entities/Story';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createStoryService, useDrizzle } from '../db';
import { useStoryStore } from '../state/storyStore';
import { useThemeStore } from '../state/themeStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';

// Define a type for the data needed to create a new story,
// omitting fields handled by the service
type NewStoryData = Omit<Story, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>;

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
  const drizzleClient = useDrizzle();
  const storyService = useRef(createStoryService(drizzleClient)).current;
  const { setSelectedStory } = useStoryStore();

  // Get client settings from stores
  const { username, language } = useUserSettingsStore();
  const { darkMode } = useThemeStore();


  const fetchStories = async () => {
    try {
      const result = await storyService.getAllStories();
      setStories(result as Story[]);
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
    const newStoryData: NewStoryData = {
      userId: 'placeholder-user-id', // TODO: Replace with actual user ID from authStore
      title: `New Story ${stories.length + 1}`,
      type: 'linear',
      description: null,
      genre: null,
      language: 'en',
      isFavorite: false,
      extraNotes: null,
      serverId: null,
    };


    try {
      const createdStory = await storyService.createStory(newStoryData);
      fetchStories();
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
    // Removed safeArea style
    mainContentContainer: {
      flex: 1, // Ensure it takes full height
      padding: 20,
      justifyContent: 'space-between',
      backgroundColor: colors.background, // Apply background color here
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
    <View style={styles.mainContentContainer}> {/* Replaced SafeAreaView with a regular View */}
      <View>
        <Text style={styles.title}>Welcome to Story Selection!</Text>
        <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>
            User: {username || 'N/A'}, Language: {language || 'N/A'}, Dark Mode: {darkMode ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.title}>Your Stories</Text>
      </View>
      <FlatList
        data={stories}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No stories found. Create one!</Text>}
        style={{ flex: 1 }}
      />
      <View style={styles.createButtonContainer}>
        <Button title="Create New Story" onPress={handleCreateNewStory} color={colors.primary} />
      </View>
    </View>
  );
};


export default StorySelectionScreen;
