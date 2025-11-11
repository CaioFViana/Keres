import { Ionicons } from '@expo/vector-icons';
import { Story } from '@keres/shared/entities/Story';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, BackHandler, Button, FlatList, StyleSheet, Text, ToastAndroid, TouchableOpacity, View } from 'react-native';
import SummaryCard from '../components/common/SummaryCard/SummaryCard';
import { createStoryService, useDrizzle } from '../db';
import { useStoryStore } from '../state/storyStore';
import { useSummaryStore } from '../state/summaryStore';
import { useThemeStore } from '../state/themeStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import { getCommonContainerStyles, getCommonCardStyles } from '../theme/commonStyles'; // Import getCommonContainerStyles and getCommonCardStyles

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
  const { colors, setTheme } = useTheme(); // Get setTheme from useTheme
  const drizzleClient = useDrizzle();
  const storyService = useRef(createStoryService(drizzleClient)).current;
  const { setSelectedStory } = useStoryStore();
  const { t } = useTranslation(); // Initialize useTranslation

  // Get summary state from Zustand store
  const { summary, updateSummary } = useSummaryStore();

  // Get client settings from stores
  const { username, language } = useUserSettingsStore();
  const { darkMode } = useThemeStore();

  const commonContainerStyles = getCommonContainerStyles(colors); // Get common container styles
  const commonCardStyles = getCommonCardStyles(colors); // Get common card styles

  const backPressTimer = useRef<number | null>(null);

  useEffect(() => {
    const backAction = () => {
      if (backPressTimer.current && Date.now() - backPressTimer.current < 2000) {
        // If pressed again within 2 seconds, exit the app
        BackHandler.exitApp();
        return true; // Event handled
      } else {
        backPressTimer.current = Date.now();
        ToastAndroid.show(t('press_back_again_to_exit'), ToastAndroid.SHORT);
        return true; // Event handled, but don't exit yet
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [t]);


  const fetchStories = async () => {
    try {
      const result = await storyService.getAllStories();
      setStories(result as Story[]);
    } catch (error) {
      console.error(t('error_fetching_stories'), error);
      Alert.alert(t('error'), t('failed_to_load_stories'));
    }
  };

  const fetchSummary = async () => {
    try {
      const storyCounts = await storyService.getStoryCounts();
      const characterCount = await storyService.getCharacterCount();
      const choiceCount = await storyService.getChoiceCount();
      const locationCount = await storyService.getLocationCount();
      const chapterCount = await storyService.getChapterCount();
      const sceneCount = await storyService.getSceneCount();
      const noteCount = await storyService.getNoteCount();
      const worldRuleCount = await storyService.getWorldRuleCount();

      updateSummary({ // Update the Zustand store
        totalStories: storyCounts.totalStories,
        branchingStories: storyCounts.branchingStories,
        characterCount,
        choiceCount: storyCounts.branchingStories > 0 ? choiceCount : 0, // Only show choices if there are branching stories
        locationCount,
        chapterCount,
        sceneCount,
        noteCount,
        worldRuleCount,
      });
    } catch (error) {
      console.error(t('error_fetching_summary'), error);
      Alert.alert(t('error'), t('failed_to_load_summary_data'));
    }
  };


  useEffect(() => {
    fetchStories();
    fetchSummary();
  }, []);


  const handleSelectStory = (story: Story) => {
    setSelectedStory(story);
    setTheme(story.theme || 'default'); // Apply story's theme
    navigation.replace('MainSystem', { storyId: story.id });
  };


  const handleCreateNewStory = async () => {
    const newStoryData: NewStoryData = {
      userId: 'placeholder-user-id', // TODO: Replace with actual user ID from authStore
      title: `${t('new_story')} ${stories.length + 1}`,
      type: 'linear',
      description: 'This is a dummy description for a new linear story. It should be long enough to be truncated.', // Add description
      genre: 'Fantasy', // Add genre
      language: 'en',
      isFavorite: false,
      extraNotes: null,
      serverId: null,
      theme: 'ocean', // Use 'ocean' theme for linear stories
    };


    try {
      const createdStory = await storyService.createStory(newStoryData);
      const storyId = createdStory.id;

      // Create dummy entities for testing
      await storyService.createCharacter({
        storyId,
        name: 'Hero Character',
        gender: 'male',
        race: 'human',
        isFavorite: false,
      });

      const chapter = await storyService.createChapter({
        storyId,
        name: 'Chapter 1',
        index: 1,
        isFavorite: false,
      });

      const location = await storyService.createLocation({
        storyId,
        name: 'Enchanted Forest',
        isFavorite: false,
      });

      const scene = await storyService.createScene({
        storyId,
        chapterId: chapter.id,
        locationId: location.id,
        name: 'Forest Entrance',
        index: 1,
        isFavorite: false,
      });

      await storyService.createNote({
        storyId,
        title: 'First Draft Ideas',
        body: 'Initial thoughts on the story.',
        isFavorite: false,
      });

      await storyService.createWorldRule({
        storyId,
        title: 'Magic System Basics',
        description: 'How magic works in this world.',
        isFavorite: false,
      });

      if (createdStory.type === 'branching') {
        await storyService.createChoice({
          storyId,
          sceneId: scene.id,
          nextSceneId: scene.id, // For simplicity, self-referencing
          text: 'Go deeper into the forest',
          isImplicit: false,
        });
      }

      fetchStories();
      fetchSummary(); // Refresh summary after creating a new story and entities
      // Removed: handleSelectStory(createdStory); // Do not navigate for testing purposes
    } catch (error) {
      console.error(t('error_creating_new_story'), error);
      Alert.alert(t('error'), t('failed_to_create_new_story'));
    }
  };

  const handleCreateNewBranchingStory = async () => {
    const newStoryData: NewStoryData = {
      userId: 'placeholder-user-id', // TODO: Replace with actual user ID from authStore
      title: `${t('new_branching_story')} ${stories.length + 1}`,
      type: 'branching', // Set type to branching
      description: 'This is a dummy description for a new branching story. It also needs to be long enough to be truncated.', // Add description
      genre: 'Sci-Fi', // Add genre
      language: 'en',
      isFavorite: false,
      extraNotes: null,
      serverId: null,
      theme: 'forest', // Use 'forest' theme for branching stories
    };

    try {
      const createdStory = await storyService.createStory(newStoryData);
      const storyId = createdStory.id;

      // Create dummy entities for testing
      await storyService.createCharacter({
        storyId,
        name: 'Branching Hero',
        gender: 'female',
        race: 'elf',
        isFavorite: false,
      });

      const chapter = await storyService.createChapter({
        storyId,
        name: 'Branching Chapter 1',
        index: 1,
        isFavorite: false,
      });

      const location = await storyService.createLocation({
        storyId,
        name: 'Crossroads',
        isFavorite: false,
      });

      const scene1 = await storyService.createScene({
        storyId,
        chapterId: chapter.id,
        locationId: location.id,
        name: 'Path A',
        index: 1,
        isFavorite: false,
      });

      // Create multiple choices for scene1 to test average
      await storyService.createChoice({
        storyId,
        sceneId: scene1.id,
        nextSceneId: scene1.id, // Self-referencing for dummy data
        text: 'Take the left path',
        isImplicit: false,
      });
      await storyService.createChoice({
        storyId,
        sceneId: scene1.id,
        nextSceneId: scene1.id, // Self-referencing for dummy data
        text: 'Take the right path',
        isImplicit: false,
      });
      await storyService.createChoice({
        storyId,
        sceneId: scene1.id,
        nextSceneId: scene1.id, // Self-referencing for dummy data
        text: 'Go straight',
        isImplicit: false,
      });

      fetchStories();
      fetchSummary(); // Refresh summary after creating a new story and entities
    } catch (error) {
      console.error(t('error_creating_new_branching_story'), error);
      Alert.alert(t('error'), t('failed_to_create_new_branching_story'));
    }
  };

  const toggleFavorite = async (storyId: string, currentFavoriteStatus: boolean) => {
    try {
      await storyService.updateStoryFavoriteStatus(storyId, !currentFavoriteStatus);
      // Update local state to reflect the change
      setStories((prevStories) =>
        prevStories.map((story) =>
          story.id === storyId ? { ...story, isFavorite: !currentFavoriteStatus } : story
        )
      );
    } catch (error) {
      console.error('Error toggling favorite status:', error);
      Alert.alert(t('error'), t('failed_to_update_favorite_status'));
    }
  };

  const renderStoryItem = ({ item }: { item: Story }) => (
    <TouchableOpacity style={[commonCardStyles.cardContainer, styles.storyItemBase]} onPress={() => handleSelectStory(item)}>
      <View style={styles.storyItemContent}>
        <Text style={styles.storyTitle}>{item.title}</Text>
        {item.description && (
          <Text style={styles.storyDescription}>
            {item.description.length > 50
              ? `${item.description.substring(0, 50)}...`
              : item.description}
          </Text>
        )}
        {item.genre && <Text style={styles.storyDetail}>{t('genre')}: {item.genre}</Text>}
        {item.serverId && <Text style={styles.storyDetail}>{t('server')}: {item.serverId}</Text>}
        {item.theme && <Text style={styles.storyDetail}>{t('theme')}: {item.theme}</Text>}
      </View>
      <TouchableOpacity onPress={() => toggleFavorite(item.id, item.isFavorite)} style={styles.favoriteButton}>
        <Ionicons
          name={item.isFavorite ? 'star' : 'star-outline'}
          size={24}
          color={item.isFavorite ? colors.star : colors.textSecondary}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );


  const styles = StyleSheet.create({
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: colors.text,
    },
    storyItemBase: {
      marginBottom: 10, // Keep margin bottom for spacing between items
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    storyItemContent: {
      flex: 1, // Take up available space
      marginRight: 10,
    },
    storyTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    storyDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 5,
    },
    storyDetail: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    favoriteButton: {
      padding: 5,
    },
    createButtonContainer: {
      marginTop: 20,
      flexDirection: 'row', // Arrange buttons horizontally
      justifyContent: 'space-around', // Distribute space evenly
    },
    dummyButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 5,
      marginLeft: 10,
    },
    dummyButtonText: {
      fontSize: 14,
      fontWeight: 'bold',
    },
  });


  return (
    <View style={commonContainerStyles.container}>
      <View>
        <Text style={styles.title}>{t('welcome_to_story_selection')}</Text>
        <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>
            {t('user_info', { username: username || 'N/A', language: language || 'N/A', darkMode: darkMode ? t('yes') : t('no') })}
        </Text>

        {summary && <SummaryCard {...summary} title={t('global_summary')} />}

        <Text style={styles.title}>{t('your_stories')}</Text>
      </View>
      <FlatList
        data={stories}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>{t('no_stories_found_create_one')}</Text>}
        style={{ flex: 1 }}
      />
      <View style={styles.createButtonContainer}>
        <Button title={t('create_new_story')} onPress={handleCreateNewStory} color={colors.primary} />
        <Button title={t('create_new_branching_story')} onPress={handleCreateNewBranchingStory} color={colors.primary} />
      </View>
    </View>
  );
};


export default StorySelectionScreen;
