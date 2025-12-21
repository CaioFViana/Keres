import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer'; // Import DrawerNavigationProp
import { CommonActions, useNavigation } from '@react-navigation/native';
import { eq } from 'drizzle-orm';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import OperationLogList from '../../components/OperationLogList/OperationLogList'; // Import OperationLogList
import SummaryCard from '../../components/common/SummaryCard/SummaryCard';
import { useDrizzle } from '../../db'; // Import useDrizzle
import * as schema from '../../db/schema';
import { MainSystemDrawerParamList } from '../../navigation/MainSystemStack'; // Import MainSystemDrawerParamList
import { createServerService } from '../../services/ServerService'; // Import createServerService
import { SyncEngineService } from '../../services/SyncEngineService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonCardStyles } from '../../theme/commonStyles';

const MainDashboardScreen = () => {
  const { colors } = useTheme();
  const commonCardStyles = getCommonCardStyles(colors);
  const { selectedStory } = useStoryStore();
  const [syncedServerUrl, setSyncedServerUrl] = useState<string | null>(null);
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


  useEffect(() => {
    // Inject the db instance into the syncEngineService
    SyncEngineService.getInstance().setDbInstance(db); // CHANGED

    async function configureAndStartSync() {
      if (selectedStory?.id) {
        console.log(`MainDashboard: Selected story changed to ${selectedStory.id}.`);
        let serverUrl: string | null = null;

        if (selectedStory.serverId) {
          try {
            const serverService = createServerService(db);
            const server = await serverService.getServerById(selectedStory.serverId);
            if (server?.url) {
              serverUrl = server.url;
              setSyncedServerUrl(server.url);
            } else {
              console.warn(`Server with ID ${selectedStory.serverId} not found or no URL configured.`);
              setSyncedServerUrl(null);
            }
          } catch (error) {
            console.error('Error fetching server details:', error);
            setSyncedServerUrl(null);
          }
        } else {
          setSyncedServerUrl(null);
        }

        SyncEngineService.getInstance().configure(selectedStory.id, serverUrl); // CHANGED
        if (serverUrl) {
          SyncEngineService.getInstance().startSync(); // CHANGED
        } else {
          SyncEngineService.getInstance().stopSync(); // CHANGED
        }
      } else {
        console.log('MainDashboard: No story selected or story deselected. Stopping sync engine.');
        SyncEngineService.getInstance().stopSync(); // CHANGED
        setSyncedServerUrl(null);
      }
    }

    async function fetchCounts() {
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
      }
    }

    configureAndStartSync();
    fetchCounts();

    return () => {
      console.log('MainDashboard: Unmounting or story changed. Stopping sync engine.');
      SyncEngineService.getInstance().stopSync(); // CHANGED
    };
  }, [selectedStory, db]); // Re-run effect if selectedStory or db changes

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
      <Text style={styles.title}>{selectedStory?.title || 'No Story Selected'}</Text>
      <Text style={styles.text}>
        Synchronized with: {syncedServerUrl || 'Not configured'} (Last server synced log: {selectedStory?.lastServerSyncedLog || 0})
      </Text>

      <SummaryCard
        title="Story Overview"
        characterCount={characterCount}
        locationCount={locationCount}
        chapterCount={chapterCount}
        sceneCount={sceneCount}
        choiceCount={selectedStory?.type === 'branching' ? choiceCount : undefined}
        noteCount={noteCount}
        worldRuleCount={worldRuleCount}
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