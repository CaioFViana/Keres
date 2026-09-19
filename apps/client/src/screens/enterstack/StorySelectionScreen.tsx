import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import SummaryCard from '@/src/components/common/display/SummaryCard/SummaryCard';
import StorySelectionListItem from '@/src/components/features/list-items/StorySelectionListItem';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { Ionicons } from '@expo/vector-icons';
import type { Story } from '@keres/shared/entities/Story';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useScreenAnchor } from '../../guides/useGuideAnchor';
import { useScreenTour } from '../../guides/useScreenTour';
import { createServerService } from '../../services/ServerService';
import { createStoryContentMetricsService } from '../../services/storymanagement/StoryContentMetricsService';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryListStore } from '../../state/storyListStore';
import { useStoryStore } from '../../state/storyStore';
import { useSummaryStore } from '../../state/summaryStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';

type RootStackParamList = {
  ColdInstall: undefined;
  StorySelection: undefined;
  MainSystem: { storyId: string };
  StoryForm: { storyId?: string };
  Settings: undefined;
};

type StorySelectionScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'StorySelection'
>;

const StorySelectionScreen = () => {
  useBackButtonHandler();
  useScreenTour('StorySelectionMain');
  const listAnchorRef = useScreenAnchor('StorySelection', 'list');
  const navigation = useNavigation<StorySelectionScreenNavigationProp>();
  const { colors, setTheme } = useTheme();
  const drizzleClient = useDrizzle();
  const storyService = useRef(createStoryService(drizzleClient)).current;
  const storyContentMetricsService = useRef(
    createStoryContentMetricsService(drizzleClient),
  ).current;
  const serverService = useRef(createServerService(drizzleClient)).current;
  const { setSelectedStory } = useStoryStore();
  const { stories, fetchStories, updateStoryFavoriteStatus } = useStoryListStore();
  const { t } = useTranslation();

  const { showNotification } = useNotificationStore();
  const [serverNamesById, setServerNamesById] = useState<Record<string, string>>({});

  const summary = useSummaryStore((state) => state.summary);
  const updateSummary = useSummaryStore((state) => state.updateSummary);

  const { userId, showTutorials, tutorialProgress, setFirstStoryProgress } = useUserSettingsStore();

  const commonContainerStyles = getCommonContainerStyles(colors);

  const backPressTimer = useRef<number | null>(null);
  const isFocused = useIsFocused();

  const fetchStoriesData = useCallback(async () => {
    await fetchStories(storyService);
  }, [fetchStories, storyService]);

  const fetchServerNames = useCallback(async () => {
    const servers = await serverService.getAllServers();
    setServerNamesById(Object.fromEntries(servers.map((server) => [server.id, server.name])));
  }, [serverService]);

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
  }, [isFocused, t, showNotification]);

  const fetchSummary = useCallback(async () => {
    try {
      const [storyCounts, contentCounts] = await Promise.all([
        storyContentMetricsService.getCatalogCounts(),
        storyContentMetricsService.getContentCounts(),
      ]);

      updateSummary({
        ...storyCounts,
        ...contentCounts,
      });
    } catch (error) {
      console.error(t('error_fetching_summary'), error);
      AppAlert.alert(t('error'), t('failed_to_load_summary_data'));
    }
  }, [storyContentMetricsService, updateSummary, t]);

  useEffect(() => {
    if (isFocused) {
      fetchStoriesData();
      fetchSummary();
      fetchServerNames();
      setTheme('default');
    }
  }, [isFocused, setTheme, fetchStoriesData, fetchSummary, fetchServerNames]);

  const handleSelectStory = useCallback(
    (story: Story) => {
      setSelectedStory(story);
      setTheme(story.theme || 'default');
      navigation.replace('MainSystem', { storyId: story.id });
    },
    [navigation, setSelectedStory, setTheme],
  );

  const handleCreateNewStory = useCallback(() => {
    navigation.navigate('StoryForm', {});
  }, [navigation]);

  const recordTrailChoice = useCallback(
    (patch: Parameters<typeof setFirstStoryProgress>[1]) => {
      setFirstStoryProgress(drizzleClient, patch).catch((error: unknown) => {
        console.warn('[StorySelectionScreen] failed to record the first-story choice.', error);
      });
    },
    [drizzleClient, setFirstStoryProgress],
  );

  const handleFirstStoryCta = useCallback(() => {
    // Tapping outside dismisses without choosing ("ask again later"); only "Later" silences the trail.
    AppAlert.alert(
      t('first_story_choice_title'),
      t('first_story_choice_message'),
      [
        {
          text: t('first_story_choice_create'),
          onPress: () => {
            navigation.navigate('StoryForm', {});
            recordTrailChoice({ choice: 'create' });
          },
        },
        {
          text: t('first_story_choice_example'),
          onPress: () => {
            navigation.getParent()?.navigate('ExampleStories');
            recordTrailChoice({ choice: 'example' });
          },
        },
        {
          text: t('first_story_choice_later'),
          style: 'cancel',
          onPress: () => {
            recordTrailChoice({ dismissed: true });
          },
        },
      ],
      { cancelable: true },
    );
  }, [navigation, recordTrailChoice, t]);

  const handleTrailLater = useCallback(() => {
    recordTrailChoice({ dismissed: true });
  }, [recordTrailChoice]);

  const showTrailCta =
    showTutorials && !tutorialProgress.firstStory?.done && !tutorialProgress.firstStory?.dismissed;

  useScreenHeader({
    target: 'parent',
    title: t('story_selection_title'),
    actions: [
      { id: 'action-0', icon: 'add', label: t('create_new_story'), onPress: handleCreateNewStory },
    ],
  });

  const handleEditStory = useCallback(
    (storyId: string) => {
      navigation.navigate('StoryForm', { storyId });
    },
    [navigation],
  );

  const toggleFavorite = useCallback(
    async (storyId: string, currentFavoriteStatus: boolean) => {
      if (!userId) {
        console.error('User not logged in. Cannot toggle favorite status.');
        return;
      }
      try {
        await storyService.updateStoryFavoriteStatus(userId, storyId, !currentFavoriteStatus);
        updateStoryFavoriteStatus(storyId, !currentFavoriteStatus);
      } catch (error) {
        console.error('Error toggling favorite status:', error);
        AppAlert.alert(t('error'), t('failed_to_update_favorite_status'));
      }
    },
    [storyService, t, updateStoryFavoriteStatus, userId],
  );

  const styles = StyleSheet.create({
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 16,
      marginTop: 4,
      color: colors.text,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 36,
      paddingHorizontal: 24,
    },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryContainer,
      marginBottom: 14,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },
    list: {
      flex: 1,
    },
    trailBanner: {
      backgroundColor: colors.primaryContainer,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    trailText: {
      color: colors.onPrimaryContainer,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    trailActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    trailLater: {
      paddingVertical: 8,
    },
    trailLaterText: {
      color: colors.onPrimaryContainer,
      fontSize: 14,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
  });

  return (
    <View style={commonContainerStyles.container}>
      {summary && <SummaryCard {...summary} title={t('global_summary')} />}

      <Text style={styles.title}>{t('your_stories')}</Text>
      {showTrailCta && (
        <View style={styles.trailBanner} testID="first-story-banner">
          <Text style={styles.trailText}>{t('first_story_choice_message')}</Text>
          <View style={styles.trailActions}>
            <Button onPress={handleFirstStoryCta} testID="first-story-cta">
              {t('first_story_cta')}
            </Button>
            <TouchableOpacity
              style={styles.trailLater}
              onPress={handleTrailLater}
              testID="first-story-later"
            >
              <Text style={styles.trailLaterText}>{t('first_story_choice_later')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View ref={listAnchorRef} collapsable={false} style={styles.list}>
        <FlatList
          data={stories}
          renderItem={({ item }) => (
            <StorySelectionListItem
              story={item}
              serverName={item.serverId ? serverNamesById[item.serverId] : undefined}
              onSelectStory={handleSelectStory}
              onToggleFavorite={toggleFavorite}
              onEditStory={handleEditStory}
            />
          )}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="book-outline" size={28} color={colors.onPrimaryContainer} />
              </View>
              <Text style={styles.emptyText}>{t('no_stories_found_create_one')}</Text>
            </View>
          }
          style={styles.list}
        />
      </View>
    </View>
  );
};

export default StorySelectionScreen;
