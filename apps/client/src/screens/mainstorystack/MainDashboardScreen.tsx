import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { CommonActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler } from 'react-native';

import { useDrizzle } from '../../db';
import type { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { createStoryAnalysisService } from '../../services/storymanagement/StoryAnalysisService';
import { createStoryContentMetricsService } from '../../services/storymanagement/StoryContentMetricsService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useSyncConflictStore } from '../../state/syncConflictStore';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { MainDashboardContent } from './MainDashboardContent';

const MainDashboardScreen = () => {
  const { selectedStory } = useStoryStore();
  const db = useDrizzle();
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
  const [forkCount, setForkCount] = useState<number | undefined>(undefined);
  const [analysisIssueCount, setAnalysisIssueCount] = useState<number | undefined>(undefined);

  const backPressTimer = useRef<number | null>(null);

  useEffect(() => {
    const backAction = () => {
      const rootStackNavigation = navigation.getParent();

      if (backPressTimer.current && Date.now() - backPressTimer.current < 2000) {
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
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'StorySelection' }],
            }),
          );
        }
        return true;
      } else {
        backPressTimer.current = Date.now();
        showNotification(t('press_back_again_to_exit'), 'info');
        return true;
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [navigation, showNotification, t]);

  const fetchCounts = useCallback(async () => {
    if (selectedStory?.id && db) {
      try {
        const storyId = selectedStory.id;
        const counts = await createStoryContentMetricsService(db).getContentCounts(storyId);

        setCharacterCount(counts.characterCount);
        setLocationCount(counts.locationCount);
        setChapterCount(counts.chapterCount);
        setSceneCount(counts.sceneCount);
        setChoiceCount(counts.choiceCount);
        setNoteCount(counts.noteCount);
        setWorldRuleCount(counts.worldRuleCount);
        setItemCount(counts.itemCount);
        setGalleryCount(counts.galleryCount);
        setTagCount(counts.tagCount);
        setCustomAttributeCount(counts.customAttributeCount);
        setForkCount(counts.branchingStoryForkCount);
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
      setForkCount(undefined);
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

  useScreenHeader({
    target: 'self',
    title: selectedStory?.title || t('dashboard_title'),
    actions: [
      {
        id: 'action-0',
        icon: 'settings-outline',
        label: t('story_settings_title'),
        onPress: () => {
          if (selectedStory?.id) {
            navigation.navigate('StorySettings', { storyId: selectedStory.id });
          } else {
            showNotification(t('no_story_selected_for_settings'), 'warning');
          }
        },
      },
    ],
  });

  return (
    <MainDashboardContent
      story={selectedStory}
      t={t}
      conflictCount={conflictCount}
      conflictSheetOpen={conflictSheetOpen}
      onOpenConflictSheet={() => setConflictSheetOpen(true)}
      onCloseConflictSheet={() => setConflictSheetOpen(false)}
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
      forkCount={forkCount}
      analysisIssueCount={analysisIssueCount}
      onOpenAnalysis={() => {
        if (selectedStory?.id) {
          navigation.navigate('StoryAnalysis', { storyId: selectedStory.id });
        }
      }}
      onOpenOperationLog={() => {
        navigation.navigate('OperationLogStack', { screen: 'OperationLog' });
      }}
    />
  );
};

export default MainDashboardScreen;
