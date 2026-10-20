import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import OperationLogList from '@/src/components/features/operation-log/OperationLogList/OperationLogList';
import { commonScreenStyleDefs } from '@/src/theme/commonStyles';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import GuideAnchor from '@/src/components/features/guides/GuideAnchor';
import { useScreenTour } from '@/src/hooks/guides/useScreenTour';
import { useNavigateAcrossStacks } from '@/src/hooks/nav/useNavigateAcrossStacks';
import React, { useCallback, useEffect, useState } from 'react'; // Import useEffect and useState
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useStoryStore } from '@/src/state/story/storyStore';
import type { ThemeColors } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { entityEventEmitter } from '@/src/state/events/EventEmitter'; // Import entityEventEmitter

const OperationLogScreen: React.FC = () => {
  useBackButtonHandler();
  useScreenTour('OperationLogStack');
  const { t } = useTranslation();

  const navigateAcross = useNavigateAcrossStacks();
  const { selectedStory } = useStoryStore();

  const [shouldRefetch, setShouldRefetch] = useState(false); // New state for refetch trigger

  useScreenHeader({
    target: 'parent',
    title: t('operation_logs_title'),
  });

  const handlePressLogItem = useCallback(
    (logId: string) => {
      // Navigate to the OperationLogDetail screen within the OperationLogStack
      navigateAcross('OperationLogStack', 'OperationLogDetail', { logId });
    },
    [navigateAcross],
  );

  // Listen for operation_log_updated event to trigger refetch
  useEffect(() => {
    const handleOperationLogUpdated = (updatedStoryId: string) => {
      if (selectedStory?.id === updatedStoryId) {
        // Only refetch if it's for the current story
        setShouldRefetch((prev) => !prev); // Toggle to trigger refetch in OperationLogList
      }
    };

    entityEventEmitter.on('operation_log_updated', handleOperationLogUpdated);

    return () => {
      entityEventEmitter.off('operation_log_updated', handleOperationLogUpdated);
    };
  }, [selectedStory?.id]);

  const styles = useThemedStyles(createStyles);

  if (!selectedStory?.id) {
    return (
      <View style={[styles.container, styles.noStoryContainer]}>
        <Text style={styles.noStoryText}>{t('no_story_selected')}</Text>
      </View>
    );
  }

  return (
    <GuideAnchor screen="OperationLog" part="list" style={styles.container}>
      <OperationLogList
        storyId={selectedStory.id}
        paginated={true}
        pageSize={20}
        onPressItem={handlePressLogItem}
        shouldRefetch={shouldRefetch}
        showPrivateGaps
      />
    </GuideAnchor>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    noStoryContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    noStoryText: {
      fontSize: 18,
      color: colors.textSecondary,
    },
  });

export default OperationLogScreen;
