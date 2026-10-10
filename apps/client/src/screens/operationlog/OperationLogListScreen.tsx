import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import OperationLogList from '@/src/components/features/operation-log/OperationLogList/OperationLogList';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useScreenTour } from '@/src/guides/useScreenTour';
import type { DrawerNavigationProp } from '@react-navigation/drawer'; // Use DrawerNavigationProp
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigateAcrossStacks } from '@/src/hooks/useNavigateAcrossStacks';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Corrected import
import React, { useCallback, useEffect, useState } from 'react'; // Import useEffect and useState
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type {
  MainSystemDrawerParamList,
  OperationLogStackParamList,
} from '../../navigation/MainSystemStack'; // Use MainSystemDrawerParamList
import { useStoryStore } from '../../state/storyStore';
import type { ThemeColors } from '../../theme';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { entityEventEmitter } from '../../utils/EventEmitter'; // Import entityEventEmitter

// Redefine OperationLogScreenNavigationProp as CompositeNavigationProp
export type OperationLogScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'OperationLogStack'>,
  NativeStackNavigationProp<OperationLogStackParamList, 'OperationLogDetail'>
>;
import GuideAnchor from '@/src/guides/GuideAnchor';

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
      // This now works because OperationLogScreenNavigationProp is a CompositeNavigationProp
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
