import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer'; // Import DrawerNavigationProp
import { CommonActions, useNavigation } from '@react-navigation/native';
import { eq, gt, sql } from 'drizzle-orm'; // Added sql for subquery
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import OperationLogList from '../../components/OperationLogList/OperationLogList'; // Import OperationLogList
import SummaryCard from '../../components/common/SummaryCard/SummaryCard';
import { useDrizzle } from '../../db'; // Import useDrizzle
import * as schema from '../../db/schema';
import { MainSystemDrawerParamList } from '../../navigation/MainSystemStack'; // Import MainSystemDrawerParamList
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';

const MainDashboardScreen = () => {
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const db = useDrizzle(); // Get the Drizzle client
  const navigation = useNavigation<DrawerNavigationProp<MainSystemDrawerParamList, 'MainDashboard'>>();
  const { showNotification } = useNotificationStore();
  const { t } = useTranslation();


  const [characterCount, setCharacterCount] = useState<number | undefined>(undefined);
  const [locationCount, setLocationCount] = useState<number | undefined>(undefined);
  const [chapterCount, setChapterCount] = useState<number | undefined>(undefined);
  const [sceneCount, setSceneCount] = useState<number | undefined>(undefined);
  const [choiceCount, setChoiceCount] = useState<number | undefined>(undefined);
  const [noteCount, setNoteCount] = useState<number | undefined>(undefined);
  const [worldRuleCount, setWorldRuleCount] = useState<number | undefined>(undefined);
  const [itemCount, setItemCount] = useState<number | undefined>(undefined);
  const [galleryCount, setGalleryCount] = useState<number | undefined>(undefined);
  const [forkCount, setForkCount] = useState<number | undefined>(undefined); // New state for fork count

  const backPressTimer = useRef<number | null>(null);

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
            })
          );
        } else {
          console.error("Could not find root stack navigation to dispatch reset action. This is unexpected.");
          // Fallback to current navigation context if parent not found
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'StorySelection' }],
            })
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
        const characters = await db.select().from(schema.characters).where(eq(schema.characters.storyId, selectedStory.id)).execute();
        setCharacterCount(characters.length);

        const locations = await db.select().from(schema.locations).where(eq(schema.locations.storyId, selectedStory.id)).execute();
        setLocationCount(locations.length);

        const chapters = await db.select().from(schema.chapters).where(eq(schema.chapters.storyId, selectedStory.id)).execute();
        setChapterCount(chapters.length);

        const scenes = await db.select().from(schema.scenes).where(eq(schema.scenes.storyId, selectedStory.id)).execute();
        setSceneCount(scenes.length);

        const choices = await db.select().from(schema.choices).where(eq(schema.choices.storyId, selectedStory.id)).execute();
        setChoiceCount(choices.length);

        const notes = await db.select().from(schema.notes).where(eq(schema.notes.storyId, selectedStory.id)).execute();
        setNoteCount(notes.length);

        const worldRules = await db.select().from(schema.worldRules).where(eq(schema.worldRules.storyId, selectedStory.id)).execute();
        setWorldRuleCount(worldRules.length);

        const items = await db.select().from(schema.items).where(eq(schema.items.storyId, selectedStory.id)).execute();
        setItemCount(items.length);

        const galleryItems = await db.select().from(schema.galleries).where(eq(schema.galleries.storyId, selectedStory.id)).execute();
        setGalleryCount(galleryItems.length);

        // Calculate forkCount: scenes with more than one choice using a subquery
        const subquery = db
          .select({
            sceneId: schema.choices.sceneId,
            choiceCount: sql<number>`count(${schema.choices.id})`.as('choice_count'), // Use sql.raw for count and .as()
          })
          .from(schema.choices)
          .where(eq(schema.choices.storyId, selectedStory.id))
          .groupBy(schema.choices.sceneId)
          .as('subquery_scene_choices'); // Give the subquery an alias

        const scenesWithMultipleChoices = await db
          .select({ sceneId: subquery.sceneId })
          .from(subquery)
          .where(gt(subquery.choiceCount, 1)) // Filter on the aliased count
          .execute();

        setForkCount(scenesWithMultipleChoices.length);

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
      setForkCount(undefined); // Reset forkCount if no story selected
    }
  }, [selectedStory?.id, db]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]); // Re-run fetchCounts if selectedStory or db changes

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
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{selectedStory?.title || t('no_story_selected')}</Text>
      <Text style={styles.text}>
        ({t('last_server_synced_log')} {selectedStory?.lastServerSyncedLog || 0})
      </Text>

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
        isBranchingStory={selectedStory?.type === 'branching'}
        branchingStoryForkCount={forkCount}
      />

      {selectedStory?.id && (
        <>
          <Text style={styles.subtitle}>{t('recent_operations')}</Text>
          <OperationLogList storyId={selectedStory.id} limit={20} />
        </>
      )}
    </ScrollView>
  );
};

export default MainDashboardScreen;