import { DrawerNavigationProp } from '@react-navigation/drawer'; // Use DrawerNavigationProp
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import OperationLogList from '../../components/OperationLogList/OperationLogList';
import { MainSystemDrawerParamList } from '../../navigation/MainSystemStack'; // Use MainSystemDrawerParamList
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';

type OperationLogScreenRouteProp = RouteProp<MainSystemDrawerParamList, 'OperationLogs'>;
type OperationLogScreenNavigationProp = DrawerNavigationProp<MainSystemDrawerParamList, 'OperationLogs'>;

const OperationLogScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<OperationLogScreenNavigationProp>();
  const route = useRoute<OperationLogScreenRouteProp>();
  const { selectedStory } = useStoryStore();

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        title: t('operation_logs_title'),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => {
              // Optionally add some action here, e.g., filter or settings for logs
              console.log('Operation Log settings pressed');
            }}
            style={{ marginRight: 15 }}
          >
            {/* <Ionicons name="options-outline" size={24} color={colors.text} /> */}
          </TouchableOpacity>
        ),
      });
    }, [navigation, colors.text, t])
  );

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
      <OperationLogList storyId={selectedStory.id} paginated={true} pageSize={20} />
    </View>
  );
};

export default OperationLogScreen;