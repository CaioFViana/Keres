import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import { Choice } from '@keres/shared/entities/Choice';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SceneSelect } from '../../../../db/schema';
import { ScenesScreenNavigationProp } from '../../../../screens/scenes/SceneListScreen';
import { useTheme } from '../../../../theme';

interface SceneNavigationControlsProps {
  storyType: 'linear' | 'branching' | undefined;
  previousScene?: SceneSelect;
  nextScene?: SceneSelect;
  choicesForScene: Choice[];
}

const SceneNavigationControls: React.FC<SceneNavigationControlsProps> = ({
  storyType,
  previousScene,
  nextScene,
  choicesForScene,
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
    choiceButton: {
      backgroundColor: colors.card,
      padding: 10,
      borderRadius: 5,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    choiceButtonText: {
      color: colors.text,
      textAlign: 'center',
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
        <Text style={styles.navigationTitle}>Choices</Text>
        {choicesForScene.map((choice) => (
          <TouchableOpacity
            key={choice.id}
            style={styles.choiceButton}
            onPress={() => handleChoiceNavigation(choice)}
          >
            <Text style={styles.choiceButtonText}>{choice.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return null;
};

export default SceneNavigationControls;
