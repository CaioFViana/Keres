import OperationLogList from '@/src/components/features/operation-log/OperationLogList/OperationLogList';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { DrawerNavigationProp } from '@react-navigation/drawer'; // Use DrawerNavigationProp
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Corrected import
import React, { useCallback, useEffect, useState } from 'react'; // Import useEffect and useState
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import {
  MainSystemDrawerParamList,
  OperationLogStackParamList,
} from '../../navigation/MainSystemStack'; // Use MainSystemDrawerParamList
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter'; // Import entityEventEmitter
import { useDocumentTitle } from '../../utils/documentTitle';

// Redefine OperationLogScreenNavigationProp as CompositeNavigationProp
export type OperationLogScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'OperationLogStack'>,
  NativeStackNavigationProp<OperationLogStackParamList, 'OperationLogDetail'>
>;

const OperationLogScreen: React.FC = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const { t } = useTranslation();
  useDocumentTitle(t('operation_logs_title'));
  const navigation = useNavigation<OperationLogScreenNavigationProp>();
  const { selectedStory } = useStoryStore();

  const [shouldRefetch, setShouldRefetch] = useState(false); // New state for refetch trigger

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        title: t('operation_logs_title'),
      });
    }, [navigation, t]),
  );

  const handlePressLogItem = useCallback(
    (logId: string) => {
      // Navigate to the OperationLogDetail screen within the OperationLogStack
      // This now works because OperationLogScreenNavigationProp is a CompositeNavigationProp
      navigation.navigate('OperationLogStack', {
        screen: 'OperationLogDetail',
        params: { logId: logId },
      });
    },
    [navigation],
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginVertical: 10,
    },
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

  if (!selectedStory?.id) {
    return (
      <View style={[styles.container, styles.noStoryContainer]}>
        <Text style={styles.noStoryText}>{t('no_story_selected')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OperationLogList
        storyId={selectedStory.id}
        paginated={true}
        pageSize={20}
        onPressItem={handlePressLogItem}
        shouldRefetch={shouldRefetch}
        showPrivateGaps
      />
    </View>
  );
};

export default OperationLogScreen;
