import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer'; // Import DrawerNavigationProp
import { CommonActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import SummaryCard from '@/src/components/common/display/SummaryCard/SummaryCard';
//import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import OperationLogList from '@/src/components/features/operation-log/OperationLogList/OperationLogList'; // Import OperationLogList
import SyncConflictBanner from '@/src/components/features/sync/SyncConflictBanner/SyncConflictBanner';
import SyncConflictReviewSheet from '@/src/components/features/sync/SyncConflictReviewSheet/SyncConflictReviewSheet';
import { useDrizzle } from '../../db'; // Import useDrizzle
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { MainSystemDrawerParamList } from '../../navigation/MainSystemStack'; // Import MainSystemDrawerParamList
import { createStoryAnalysisService } from '../../services/storymanagement/StoryAnalysisService';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useSyncConflictStore } from '../../state/syncConflictStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';

const MainDashboardScreen = () => {
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const { isWide } = useResponsiveLayout();
  const db = useDrizzle(); // Get the Drizzle client
  const navigation =
    useNavigation<DrawerNavigationProp<MainSystemDrawerParamList, 'MainDashboard'>>();
  const { showNotification } = useNotificationStore();
  const { t } = useTranslation();
  const conflictCount = useSyncConflictStore((state) => state.conflicts.length);
  const [conflictSheetOpen, setConflictSheetOpen] = useState(false);

  const [characterCount, setCharacterCount] = useState<number | undefined>(undefined);
  const [locationCount, setLocationCount] = useState<number | undefined>(undefined);
  const [chapterCount, setChapterCount] = useState<number | undefined>(undefined);
  const [sceneCount, setSceneCount] = useState<number | undefined>(undefined);
  const [choiceCount, setChoiceCount] = useState<number | undefined>(undefined);
  const [noteCount, setNoteCount] = useState<number | undefined>(undefined);
  const [worldRuleCount, setWorldRuleCount] = useState<number | undefined>(undefined);
  const [itemCount, setItemCount] = useState<number | undefined>(undefined);
  const [galleryCount, setGalleryCount] = useState<number | undefined>(undefined);
  const [tagCount, setTagCount] = useState<number | undefined>(undefined);
  const [customAttributeCount, setCustomAttributeCount] = useState<number | undefined>(undefined);
  const [forkCount, setForkCount] = useState<number | undefined>(undefined); // New state for fork count
  const [analysisIssueCount, setAnalysisIssueCount] = useState<number | undefined>(undefined);

  const backPressTimer = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(selectedStory?.title || t('dashboard_title'));
    }, [selectedStory?.title, t]),
  );

  useEffect(() => {
    const backAction = () => {
      // Get the navigation object for the RootStack (which contains the Drawer Navigator)
      // `navigation.getParent()` when called from a screen inside a drawer navigator,
      // returns the navigation object of the stack navigator that contains the drawer.
      const rootStackNavigation = navigation.getParent(); // This is the navigation object for the 'MainSystem' screen in RootStack

      if (backPressTimer.current && Date.now() - backPressTimer.current < 2000) {
        // Double press, reset to StorySelection
        if (rootStackNavigation) {
          rootStackNavigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'StorySelection' }],
            }),
          );
        } else {
          console.error(
            'Could not find root stack navigation to dispatch reset action. This is unexpected.',
          );
          // Fallback to current navigation context if parent not found
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'StorySelection' }],
            }),
          );
        }
        return true; // Event handled
      } else {
        backPressTimer.current = Date.now();
        showNotification(t('press_back_again_to_exit'), 'info'); // Using translation
        return true; // Event handled, but don't exit yet
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [navigation, showNotification, t]); // Add t to dependencies

  const fetchCounts = useCallback(async () => {
    if (selectedStory?.id && db) {
      try {
        const storyService = createStoryService(db);
        const storyId = selectedStory.id;
        const [
          characters,
          locations,
          chapters,
          scenes,
          choices,
          notes,
          worldRules,
          items,
          galleryItems,
          tags,
          customAttributes,
          forks,
        ] = await Promise.all([
          storyService.getCharacterCount(storyId),
          storyService.getLocationCount(storyId),
          storyService.getChapterCount(storyId),
          storyService.getSceneCount(storyId),
          storyService.getChoiceCount(storyId),
          storyService.getNoteCount(storyId),
          storyService.getWorldRuleCount(storyId),
          storyService.getItemCount(storyId),
          storyService.getGalleryCount(storyId),
          storyService.getTagCount(storyId),
          storyService.getCustomAttributeCount(storyId),
          storyService.getBranchingStoryForkCount(storyId),
        ]);

        setCharacterCount(characters);
        setLocationCount(locations);
        setChapterCount(chapters);
        setSceneCount(scenes);
        setChoiceCount(choices);
        setNoteCount(notes);
        setWorldRuleCount(worldRules);
        setItemCount(items);
        setGalleryCount(galleryItems);
        setTagCount(tags);
        setCustomAttributeCount(customAttributes);
        setForkCount(forks);
      } catch (error) {
        console.error('Error fetching entity counts:', error);
      }
    } else {
      setCharacterCount(undefined);
      setLocationCount(undefined);
      setChapterCount(undefined);
      setSceneCount(undefined);
      setChoiceCount(undefined);
      setNoteCount(undefined);
      setWorldRuleCount(undefined);
      setItemCount(undefined);
      setGalleryCount(undefined);
      setTagCount(undefined);
      setCustomAttributeCount(undefined);
      setForkCount(undefined); // Reset forkCount if no story selected
    }
  }, [selectedStory?.id, db]);

  const runAnalysis = useCallback(async () => {
    if (!selectedStory?.id || !db) {
      setAnalysisIssueCount(undefined);
      return;
    }
    try {
      const report = await createStoryAnalysisService(db).analyzeStoryCheap(selectedStory.id);
      setAnalysisIssueCount(report.findings.length);
    } catch (error) {
      console.error('Error running story analysis:', error);
      setAnalysisIssueCount(undefined);
    }
  }, [selectedStory?.id, db]);

  useFocusEffect(
    useCallback(() => {
      fetchCounts();
      runAnalysis();
    }, [fetchCounts, runAnalysis]),
  );

  useEffect(() => {
    const handleRemoteChange = (change: { storyId?: string }) => {
      if (change?.storyId === selectedStory?.id) {
        fetchCounts();
        runAnalysis();
      }
    };
    entityEventEmitter.on('story_data_changed', handleRemoteChange);
    return () => entityEventEmitter.off('story_data_changed', handleRemoteChange);
  }, [selectedStory?.id, fetchCounts, runAnalysis]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            if (selectedStory?.id) {
              navigation.navigate('StorySettings', { storyId: selectedStory.id });
            } else {
              showNotification(t('no_story_selected_for_settings'), 'warning'); // New translation key
            }
          }}
          style={{ marginRight: 15 }}
        >
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, selectedStory?.id, showNotification, t, colors.text]); // Dependencies

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      width: '100%',
      maxWidth: isWide ? 1280 : undefined,
      alignSelf: 'center',
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 10,
      color: colors.text,
    },
    subtitle: {
      fontSize: 18,
      fontWeight: '600',
      marginTop: 15,
      marginBottom: 5,
      color: colors.text,
    },
    text: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 5,
    },
    input: {
      height: 40,
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 10,
      marginBottom: 10,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    buttonContainer: {
      marginTop: 10,
      marginBottom: 20,
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: 5,
    },
    themedText: {
      fontSize: 16,
      color: colors.primary,
      marginTop: 10,
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{selectedStory?.title || t('no_story_selected')}</Text>
      {selectedStory?.serverId && (
        <Text style={styles.text}>
          ({t('last_server_synced_log')} {selectedStory.lastServerSyncedLog || 0})
        </Text>
      )}

      {selectedStory?.id && (
        <SyncConflictBanner count={conflictCount} onPress={() => setConflictSheetOpen(true)} />
      )}

      <SummaryCard
        title={t('story_overview')}
        characterCount={characterCount}
        locationCount={locationCount}
        chapterCount={chapterCount}
        sceneCount={sceneCount}
        choiceCount={choiceCount}
        noteCount={noteCount}
        worldRuleCount={worldRuleCount}
        itemCount={itemCount}
        galleryCount={galleryCount}
        tagCount={tagCount}
        customAttributeCount={customAttributeCount}
        isBranchingStory={selectedStory?.type === 'branching'}
        branchingStoryForkCount={forkCount}
        analysisSummary={
          selectedStory?.id && analysisIssueCount !== undefined
            ? {
                issueCount: analysisIssueCount,
                onPress: () => navigation.navigate('StoryAnalysis', { storyId: selectedStory.id }),
              }
            : undefined
        }
      />

      {selectedStory?.id && (
        <>
          <Text style={styles.subtitle}>{t('recent_operations')}</Text>
          <OperationLogList storyId={selectedStory.id} limit={20} />
        </>
      )}

      <SyncConflictReviewSheet
        visible={conflictSheetOpen}
        onClose={() => setConflictSheetOpen(false)}
      />
    </ScrollView>
  );
};
// Commented out code. While i do like the idea of having a "how many did favorited this story" for story itself. didnt fit the project.
// Code is still here isolated to prove it exist along with its import at the top in case i change my mind.
// In the end, dashboard screen doesnt need it.
//{selectedStory?.id && (
//  <FavoritedByList storyId={selectedStory.id} entityId={selectedStory.id} entityType="Story" />
//)}

export default MainDashboardScreen;
