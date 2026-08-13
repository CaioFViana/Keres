import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import { Choice } from '@keres/shared/entities/Choice';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SceneSelect } from '../../../../db/schema';
import type { MainSystemDrawerParamList } from '../../../../navigation/MainSystemStack';
import { ScenesScreenNavigationProp } from '../../../../screens/scenes/SceneListScreen';
import { useTheme } from '../../../../theme';
import { navigateToEntityDetail } from '../../../../utils/entityNavigation';

interface SceneNavigationControlsProps {
  storyType: 'linear' | 'branching' | undefined;
  previousScene?: SceneSelect;
  nextScene?: SceneSelect;
  choicesForScene: Choice[];
  /** Nome de cada Scene por id, pra rotular o alvo de cada Choice - ver `SceneDetailScreen.fetchSceneNames`. */
  sceneNamesById?: Record<string, string>;
}

const SceneNavigationControls: React.FC<SceneNavigationControlsProps> = ({
  storyType,
  previousScene,
  nextScene,
  choicesForScene,
  sceneNamesById = {},
}) => {
  const { t }= useTranslation()
  const { colors } = useTheme();
  const navigation = useNavigation<ScenesScreenNavigationProp>();

  const styles = StyleSheet.create({
    container: {
      marginTop: 20,
      paddingTop: 15,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    navigationTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    navButton: {
      backgroundColor: colors.primary,
      padding: 10,
      borderRadius: 5,
      alignItems: 'center',
      flex: 1,
      marginHorizontal: 5,
      flexDirection: 'row', // To align icon and text
      justifyContent: 'center', // Center content horizontally
    },
    navButtonText: {
      color: colors.onPrimary,
      fontWeight: 'bold',
      marginLeft: 5, // Space between icon and text
    },
    choiceCard: {
      backgroundColor: colors.card,
      borderRadius: 5,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    choiceMain: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
    },
    choiceButtonText: {
      color: colors.text,
    },
    choiceTargetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    choiceTargetText: {
      color: colors.textSecondary,
      fontSize: 13,
      marginLeft: 4,
    },
    choiceDetailButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    choiceDetailButtonText: {
      color: colors.primary,
      fontSize: 13,
      marginLeft: 4,
    },
    disabledButton: {
      backgroundColor: colors.card,
    },
    disabledButtonText: {
      color: colors.textSecondary,
    },
    navIcon: {
      color: colors.onPrimary,
    },
    disabledNavIcon: {
      color: colors.textSecondary,
    },
  });

  const handleSceneNavigation = (sceneId: string) => {
    navigation.navigate('SceneDetail', { sceneId });
  };

  const handleChoiceNavigation = (choice: Choice) => {
    // For branching stories, navigate to the scene determined by the choice
    navigation.navigate('SceneDetail', { sceneId: choice.nextSceneId });
  };

  const handleChoiceDetailNavigation = (choiceId: string) => {
    const drawerNavigation = navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
    if (drawerNavigation) {
      navigateToEntityDetail(drawerNavigation, 'Choice', choiceId);
    }
  };

  if (storyType === 'linear') {
    return (
      <View style={styles.container}>
        <Text style={styles.navigationTitle}>{t('scene_navigation')}</Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.navButton, !previousScene && styles.disabledButton]}
            onPress={() => previousScene && handleSceneNavigation(previousScene.id)}
            disabled={!previousScene}
          >
            <Ionicons
              name="arrow-back"
              size={18}
              style={[styles.navIcon, !previousScene && styles.disabledNavIcon]}
            />
            <Text style={[styles.navButtonText, !previousScene && styles.disabledButtonText]}>
              {previousScene ? previousScene.name : t('previous_scene')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navButton, !nextScene && styles.disabledButton]}
            onPress={() => nextScene && handleSceneNavigation(nextScene.id)}
            disabled={!nextScene}
          >
            <Text style={[styles.navButtonText, !nextScene && styles.disabledButtonText]}>
              {nextScene ? nextScene.name : t('next_scene')}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              style={[styles.navIcon, !nextScene && styles.disabledNavIcon]}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  } else if (storyType === 'branching' && choicesForScene.length > 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.navigationTitle}>{t('choices_title')}</Text>
        {choicesForScene.map((choice) => (
          <View key={choice.id} style={styles.choiceCard}>
            <TouchableOpacity
              style={styles.choiceMain}
              onPress={() => handleChoiceNavigation(choice)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceButtonText}>{choice.text}</Text>
                <View style={styles.choiceTargetRow}>
                  <Ionicons name="arrow-forward" size={13} color={colors.textSecondary} />
                  <Text style={styles.choiceTargetText}>
                    {sceneNamesById[choice.nextSceneId] ?? t('common_na')}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.choiceDetailButton}
              onPress={() => handleChoiceDetailNavigation(choice.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.choiceDetailButtonText}>{t('view_choice_details')}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }

  return null;
};

export default SceneNavigationControls;
