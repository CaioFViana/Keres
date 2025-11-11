import { Ionicons } from '@expo/vector-icons';
import { Story } from '@keres/shared/entities/Story';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, BackHandler, FlatList, StyleSheet, Text, ToastAndroid, TouchableOpacity, View } from 'react-native';
import SummaryCard from '../components/common/SummaryCard/SummaryCard';
import { createStoryService, useDrizzle } from '../db';
import { useStoryStore } from '../state/storyStore';
import { useSummaryStore } from '../state/summaryStore';
import { useThemeStore } from '../state/themeStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import { getCommonCardStyles, getCommonContainerStyles } from '../theme/commonStyles';
import { getThemeColors } from '../theme/utils';

type RootStackParamList = {
  ColdInstall: undefined;
  StorySelection: undefined;
  MainSystem: { storyId: string };
  StoryForm: undefined;
  Settings: undefined; // Added Settings to RootStackParamList
};

type StorySelectionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'StorySelection'>;

// ThemedStoryItem component
interface ThemedStoryItemProps {
  story: Story;
  onSelectStory: (story: Story) => void;
  onToggleFavorite: (storyId: string, currentFavoriteStatus: boolean) => void;
  commonCardStyles: any; // Type for common card styles
  styles: any; // Type for local styles
  t: (key: string) => string; // Type for translation function
}

const ThemedStoryItem: React.FC<ThemedStoryItemProps> = ({
  story,
  onSelectStory,
  onToggleFavorite,
  commonCardStyles,
  styles,
  t,
}) => {
  const storyThemeColors = getThemeColors(story.theme);

  return (
    <TouchableOpacity
      style={[
        commonCardStyles.cardContainer,
        styles.storyItemBase,
        { backgroundColor: storyThemeColors.card, borderColor: storyThemeColors.border, borderWidth: 3 },
      ]}
      onPress={() => onSelectStory(story)}
    >
      <View style={styles.storyItemContent}>
        <Text style={[styles.storyTitle, { color: storyThemeColors.text }]}>{story.title}</Text>
        {story.genre && <Text style={[styles.storyDetail, { color: storyThemeColors.textSecondary }]}>{t('genre')}: {story.genre}</Text>}
        {story.serverId && <Text style={[styles.storyDetail, { color: storyThemeColors.textSecondary }]}>{t('server')}: {story.serverId}</Text>}
        {story.description && (
          <Text style={[styles.storyDescription, { color: storyThemeColors.textSecondary }]}>
            {story.description.length > 50
              ? `${story.description.substring(0, 50)}...`
              : story.description}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={() => onToggleFavorite(story.id, story.isFavorite)} style={styles.favoriteButton}>
        <Ionicons
          name={story.isFavorite ? 'star' : 'star-outline'}
          size={24}
          color={story.isFavorite ? storyThemeColors.star : storyThemeColors.textSecondary}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};


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
  const isFocused = useIsFocused(); // Initialize useIsFocused

  useEffect(() => {
    if (!isFocused) {
      return; // Only add listener if screen is focused
    }

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
  }, [isFocused, t]); // Depend on isFocused and t


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

  const handleCreateNewStory = () => {
    navigation.navigate('StoryForm');
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
    floatingButton: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      backgroundColor: colors.primary,
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 8,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    floatingButtonText: {
      color: colors.primary,
      fontSize: 30,
      lineHeight: 30, // Adjust line height to center the '+'
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    floatingSettingsButton: {
      position: 'absolute',
      bottom: 90, // Position above the floatingButton (bottom: 20 + height: 60 + some margin)
      right: 30,
      backgroundColor: colors.primary,
      width: 40, // Consistent size with floatingButton
      height: 40, // Consistent size with floatingButton
      borderRadius: 30, // Consistent with floatingButton
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 8,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      zIndex: 1,
    },
  });


  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  return (
    <View style={commonContainerStyles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>{t('welcome_to_story_selection')}</Text>
      </View>
      <TouchableOpacity onPress={handleSettingsPress} style={styles.floatingSettingsButton}>
        <Ionicons name="settings-outline" size={24} color={colors.onPrimary} />
      </TouchableOpacity>
      <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>
          {t('user_info', { username: username || 'N/A', language: language || 'N/A', darkMode: darkMode ? t('yes') : t('no') })}
      </Text>

      {summary && <SummaryCard {...summary} title={t('global_summary')} />}

      <Text style={styles.title}>{t('your_stories')}</Text>
      <FlatList
        data={stories}
        renderItem={({ item }) => (
          <ThemedStoryItem
            story={item}
            onSelectStory={handleSelectStory}
            onToggleFavorite={toggleFavorite}
            commonCardStyles={commonCardStyles}
            styles={styles}
            t={t}
          />
        )}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>{t('no_stories_found_create_one')}</Text>}
        style={{ flex: 1 }}
      />
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={handleCreateNewStory}
        onLongPress={() => ToastAndroid.show(t('create_new_story'), ToastAndroid.SHORT)}
      >
        <Ionicons name="create-outline" size={30} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};


export default StorySelectionScreen;
