import { Ionicons } from '@expo/vector-icons';
import { Story } from '@keres/shared/entities/Story';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, BackHandler, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SummaryCard from '../../components/common/SummaryCard/SummaryCard';
import { createStoryService, useDrizzle } from '../../db';
import { createServerService } from '../../services/ServerService';
import { ServerStoryPreview, SyncEngineService } from '../../services/SyncEngineService'; // CHANGED: Added ServerStoryPreview
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useSummaryStore } from '../../state/summaryStore';
import { useThemeStore } from '../../state/themeStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonCardStyles, getCommonContainerStyles, getThemeColors } from '../../theme/commonStyles';

type RootStackParamList = {
  ColdInstall: undefined;
  StorySelection: undefined;
  MainSystem: { storyId: string };
  StoryForm: { storyId?: string }; // Updated to accept optional storyId
  Settings: undefined;
};

type StorySelectionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'StorySelection'>;

// ThemedStoryItem component
interface ThemedStoryItemProps {
  story: Story;
  onSelectStory: (story: Story) => void;
  onToggleFavorite: (storyId: string, currentFavoriteStatus: boolean) => void;
  onEditStory: (storyId: string) => void;
  commonCardStyles: any;
  styles: any;
  t: (key: string) => string;
}

const ThemedStoryItem: React.FC<ThemedStoryItemProps> = ({
  story,
  onSelectStory,
  onToggleFavorite,
  onEditStory,
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons
            name={story.type === 'branching' ? 'git-branch-outline' : 'book-outline'}
            size={20}
            color={storyThemeColors.text}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.storyTitle, { color: storyThemeColors.text }]}>{story.title}</Text>
        </View>
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
      <View style={styles.storyItemActions}>
        <TouchableOpacity onPress={() => onToggleFavorite(story.id, story.isFavorite)} style={styles.actionButton}>
          <Ionicons
            name={story.isFavorite ? 'star' : 'star-outline'}
            size={24}
            color={story.isFavorite ? storyThemeColors.star : storyThemeColors.textSecondary}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onEditStory(story.id)} style={styles.actionButton}>
          <Ionicons name="pencil-outline" size={24} color={storyThemeColors.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};


const StorySelectionScreen = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const navigation = useNavigation<StorySelectionScreenNavigationProp>();
  const { colors, setTheme } = useTheme();
  const drizzleClient = useDrizzle();
  const storyService = useRef(createStoryService(drizzleClient)).current;
  const { setSelectedStory } = useStoryStore();
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();

  const summary = useSummaryStore((state) => state.summary);
  const updateSummary = useSummaryStore((state) => state.updateSummary);

  const { username, language, userId } = useUserSettingsStore();
  const { darkMode } = useThemeStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonCardStyles = getCommonCardStyles(colors);

  const backPressTimer = useRef<number | null>(null);
  const isFocused = useIsFocused();

  const fetchStories = useCallback(async () => {
    try {
      const result = await storyService.getAllStories();
      setStories(result as Story[]);
    } catch (error) {
      console.error(t('error_fetching_stories'), error);
      Alert.alert(t('error'), t('failed_to_load_stories'));
    }
  }, [storyService, t]);

  const syncStoriesWithServers = useCallback(async () => {
    if (!drizzleClient || !userId) {
      console.warn('Drizzle client or userId not available for sync. Skipping.');
      return;
    }

    // Set DB instance for sync engine
    SyncEngineService.getInstance().setDbInstance(drizzleClient);

    const serverService = createServerService(drizzleClient);
    const localStories = await storyService.getAllStories();
    const servers = await serverService.getAllServers();

    for (let server of servers) { // Use 'let' for server to allow re-assignment
      if (!server.url) {
        console.warn(`Server ${server.name} has no URL configured. Skipping.`);
        continue;
      }

      console.log(`Checking server ${server.name} at ${server.url} for new stories...`);
      try {
        // Attempt to refresh JWT token if expired
        server = await serverService.refreshServerToken(server);

        const serverStoryPreviews = await SyncEngineService.getInstance().fetchServerStoryPreviews(server.url);

        const localStoryIds = new Set(localStories.map(s => s.id));
        const newStoriesOnServer = serverStoryPreviews.filter(
          (preview: ServerStoryPreview) => !localStoryIds.has(preview.storyId) // CHANGED: Added type
        );

        if (newStoriesOnServer.length > 0) {
          console.log(`Found ${newStoriesOnServer.length} new stories on server ${server.name}:`);
          for (const storyPreview of newStoriesOnServer) {
            console.log(`  - Story ID: ${storyPreview.storyId}, Last Operation Version: ${storyPreview.lastOperationVersion}`);
            try {
              await SyncEngineService.getInstance().downloadAndImportStory(server.id, storyPreview.storyId, server.idUser);
              console.log(`Successfully downloaded and imported story ${storyPreview.storyId}.`);
              // After successful import, re-fetch stories to update the list
              fetchStories();
            } catch (downloadError) {
              console.error(`Failed to download and import story ${storyPreview.storyId}:`, downloadError);
            }
          }
        } else {
          console.log(`No new stories found on server ${server.name}.`);
        }
      } catch (error) {
        console.error(`Error during sync with server ${server.name} at ${server.url}:`, error);
      }
    }
  }, [drizzleClient, userId, storyService, fetchStories]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const backAction = () => {
      if (backPressTimer.current && Date.now() - backPressTimer.current < 2000) {
        BackHandler.exitApp();
        return true;
      } else {
        backPressTimer.current = Date.now();
        showNotification(t('press_back_again_to_exit'), 'info');
        return true;
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [isFocused, t]);

  const fetchSummary = useCallback(async () => {
    try {
      const storyCounts = await storyService.getStoryCounts();
      const characterCount = await storyService.getCharacterCount();
      const choiceCount = await storyService.getChoiceCount();
      const locationCount = await storyService.getLocationCount();
      const chapterCount = await storyService.getChapterCount();
      const sceneCount = await storyService.getSceneCount();
      const noteCount = await storyService.getNoteCount();
      const worldRuleCount = await storyService.getWorldRuleCount();
      const branchingStoryForkCount = await storyService.getBranchingStoryForkCount();

      updateSummary({
        totalStories: storyCounts.totalStories,
        branchingStories: storyCounts.branchingStories,
        characterCount,
        choiceCount: storyCounts.branchingStories > 0 ? choiceCount : 0,
        locationCount,
        chapterCount,
        sceneCount,
        noteCount,
        worldRuleCount,
        branchingStoryForkCount,
      });
    } catch (error) {
      console.error(t('error_fetching_summary'), error);
      Alert.alert(t('error'), t('failed_to_load_summary_data'));
    }
  }, [storyService, updateSummary, t]);

  useEffect(() => {
    if (isFocused) {
      fetchStories();
      fetchSummary();
      setTheme('default');
      
      syncStoriesWithServers();
      const syncInterval = setInterval(syncStoriesWithServers, 1800000);

      return () => {
        clearInterval(syncInterval);
      };
    }
  }, [isFocused, setTheme, fetchStories, fetchSummary]);


  const handleSelectStory = (story: Story) => {
    setSelectedStory(story);
    setTheme(story.theme || 'default');
    navigation.replace('MainSystem', { storyId: story.id });
  };

  const handleCreateNewStory = () => {
    navigation.navigate('StoryForm', {});
  };

  const handleEditStory = (storyId: string) => {
    navigation.navigate('StoryForm', { storyId });
  };

  const toggleFavorite = async (storyId: string, currentFavoriteStatus: boolean) => {
    if (!userId) {
      console.error('User not logged in. Cannot toggle favorite status.');
      return;
    }
    try {
      await storyService.updateStoryFavoriteStatus(userId, storyId, !currentFavoriteStatus);
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
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    storyItemContent: {
      flex: 1,
      marginRight: 10,
    },
    storyItemActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      padding: 5,
      marginLeft: 10,
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
  });

  return (
    <View style={commonContainerStyles.container}>
      {summary && <SummaryCard {...summary} title={t('global_summary')} />}

      <Text style={styles.title}>{t('your_stories')}</Text>
      <FlatList
        data={stories}
        renderItem={({ item }) => (
          <ThemedStoryItem
            story={item}
            onSelectStory={handleSelectStory}
            onToggleFavorite={toggleFavorite}
            onEditStory={handleEditStory}
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
        onLongPress={() => showNotification(t('create_new_story'), 'info')}
      >
        <Ionicons name="add-outline" size={30} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};


export default StorySelectionScreen;