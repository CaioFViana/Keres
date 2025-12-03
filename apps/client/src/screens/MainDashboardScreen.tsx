import { eq } from 'drizzle-orm';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import SummaryCard from '../components/common/SummaryCard/SummaryCard';
import { useDrizzle } from '../db'; // Import useDrizzle
import * as schema from '../db/schema';
import { createServerService } from '../services/ServerService'; // Import createServerService
import { syncEngineService } from '../services/SyncEngineService';
import { useStoryStore } from '../state/storyStore';
import { useTheme } from '../theme';
import { getCommonCardStyles } from '../theme/commonStyles';


const MainDashboardScreen = () => {
  const { colors } = useTheme();
  const commonCardStyles = getCommonCardStyles(colors);
  const { selectedStory } = useStoryStore();
  const [syncedServerUrl, setSyncedServerUrl] = useState<string | null>(null);
  const db = useDrizzle(); // Get the Drizzle client

  const [characterCount, setCharacterCount] = useState<number | undefined>(undefined);
  const [locationCount, setLocationCount] = useState<number | undefined>(undefined);
  const [chapterCount, setChapterCount] = useState<number | undefined>(undefined);
  const [sceneCount, setSceneCount] = useState<number | undefined>(undefined);
  const [choiceCount, setChoiceCount] = useState<number | undefined>(undefined);
  const [noteCount, setNoteCount] = useState<number | undefined>(undefined);
  const [worldRuleCount, setWorldRuleCount] = useState<number | undefined>(undefined);


  useEffect(() => {
    // Inject the db instance into the syncEngineService
    syncEngineService.setDbInstance(db);

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

        syncEngineService.configure(selectedStory.id, serverUrl);
        if (serverUrl) {
          syncEngineService.startSync();
        } else {
          syncEngineService.stopSync();
        }
      } else {
        console.log('MainDashboard: No story selected or story deselected. Stopping sync engine.');
        syncEngineService.stopSync();
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
      syncEngineService.stopSync();
    };
  }, [selectedStory, db]); // Re-run effect if selectedStory or db changes

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

  const testData = [
    { id: '1', text: 'Test Item 1' },
    { id: '2', text: 'Test Item 2' },
    { id: '3', text: 'Test Item 3' },
  ];

  const renderTestItem = ({ item }: { item: { id: string; text: string } }) => (
    <View style={commonCardStyles.cardContainer}>
      <Text style={commonCardStyles.cardText}>{item.text}</Text>
    </View>
  );

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

    </ScrollView>
  );
};

export default MainDashboardScreen;


