import NoteManager from '@/src/components/NoteManager/NoteManager';
import { createNoteRelationService, NoteRelationServiceInterface } from '@/src/services/NoteRelationService';
import { createNoteService, NoteService } from '@/src/services/NoteService';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { Ionicons } from '@expo/vector-icons';
import { Note, NoteRelation } from '@keres/shared';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { LocationSelect, TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { LocationStackParamList } from '../../navigation/MainSystemStack';
import { createLocationService } from '../../services/LocationService';
import { createTagRelationService } from '../../services/TagRelationService';
import { createTagService } from '../../services/TagService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { LocationsScreenNavigationProp } from './LocationListScreen';

export type LocationDetailScreenParamList = {
  LocationDetail: { locationId: string };
};

type LocationDetailScreenRouteProp = RouteProp<LocationStackParamList, 'LocationDetail'>;

const LocationDetailsScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<LocationsScreenNavigationProp>(); // Use the imported navigation type
  const route = useRoute<LocationDetailScreenRouteProp>();
  const { locationId } = route.params;
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const locationServiceRef = useRef<ReturnType<typeof createLocationService> | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);
  const noteServiceRef = useRef<NoteService | null>(null); // Ref for NoteService
  const noteRelationServiceRef = useRef<NoteRelationServiceInterface | null>(null); // Ref for NoteRelationService

  const [location, setLocation] = useState<LocationSelect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationTags, setLocationTags] = useState<TagSelect[]>([]);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));
  const [allNotes, setAllNotes] = useState<Note[]>([]); // State for all notes in story
  const [locationNoteRelations, setLocationNoteRelations] = useState<NoteRelation[]>([]); // State for note relations
  const { userId } = useUserSettingsStore(); // Get userId from store


  useEffect(() => {
    if (drizzleDb) {
      if (!locationServiceRef.current) {
        locationServiceRef.current = createLocationService(drizzleDb);
      }
      if (!tagServiceRef.current) {
        tagServiceRef.current = createTagService(drizzleDb);
      }
      if (!tagRelationServiceRef.current) {
        tagRelationServiceRef.current = createTagRelationService(drizzleDb);
      }
      if (!noteServiceRef.current) {
        noteServiceRef.current = createNoteService(drizzleDb);
      }
      if (!noteRelationServiceRef.current) {
        noteRelationServiceRef.current = createNoteRelationService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: headerTitle,
        headerRight: () => (
          location ? (
            <TouchableOpacity onPress={() => navigation.navigate('LocationForm', { locationId: location.id })}>
              <Ionicons name="pencil-outline" size={24} color={colors.primary} style={{ marginRight: 15 }} />
            </TouchableOpacity>
          ) : null
        ),
      });
    }, [navigation, location, headerTitle, t, colors])
  );

  const fetchLocationDetails = useCallback(async () => {
    if (!locationServiceRef.current || !locationId) {
      setError(t('failed_to_load_location'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const fetchedLocation = await locationServiceRef.current.getById(locationId);
      if (fetchedLocation && !fetchedLocation.isDeleted) {
        setLocation(fetchedLocation);
        setHeaderTitle(fetchedLocation.name || t('location_details_title'));
      } else if (fetchedLocation && fetchedLocation.isDeleted) {
        navigation.goBack();
      }
      else {
        setError(t('location_not_found'));
        setHeaderTitle(t('location_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch location details:', err);
      setError(t('failed_to_load_location'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [locationId, navigation, setLocation, setLoading, setError, setHeaderTitle, locationServiceRef.current, t]);

  const fetchTagsForLocation = useCallback(async () => {
    if (!tagRelationServiceRef.current || !selectedStory?.id || !locationId) {
      setLocationTags([]);
      return;
    }
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(selectedStory.id, locationId, 'Location');
      setLocationTags(fetchedTags);
    } catch (err) {
      console.error('Failed to fetch tags for location:', err);
      // Optionally set an error state for tags specifically
    }
  }, [selectedStory?.id, locationId, tagRelationServiceRef.current]);

  const fetchNotesForStory = useCallback(async () => {
    if (!noteServiceRef.current || !selectedStory?.id) {
      setAllNotes([]);
      return;
    }
    try {
      const fetchedNotes = await noteServiceRef.current.getNotesByStoryId(selectedStory.id);
      setAllNotes(fetchedNotes);
    } catch (err) {
      console.error('Failed to fetch notes for story:', err);
    }
  }, [selectedStory?.id, noteServiceRef.current]);

  const fetchNoteRelationsForLocation = useCallback(async () => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !locationId) {
      setLocationNoteRelations([]);
      return;
    }
    try {
      const fetchedNoteRelations = await noteRelationServiceRef.current.getRelationsForEntity(selectedStory.id, locationId, 'Location');
      setLocationNoteRelations(fetchedNoteRelations);
    } catch (err) {
      console.error('Failed to fetch note relations for location:', err);
    }
  }, [selectedStory?.id, locationId, noteRelationServiceRef.current]);

  const handleLocationChange = useCallback(async (changedStoryId: string, changedLocationId: string) => {
    if (changedLocationId === locationId) {
      if (locationServiceRef.current) {
        const updatedLocation = await locationServiceRef.current.getById(locationId);
        if (!updatedLocation || updatedLocation.isDeleted) {
          navigation.goBack();
        } else {
          setLocation(updatedLocation);
        }
      }
    }
  }, [locationId, navigation, setLocation, locationServiceRef.current]);

  const handleTagRelationChange = useCallback((changedStoryId: string, changedEntityId: string) => {
    if (changedEntityId === locationId) {
      fetchTagsForLocation();
    }
  }, [locationId, fetchTagsForLocation]);

  const handleNoteChange = useCallback((changedStoryId: string, changedNoteId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchNotesForStory();
    }
  }, [selectedStory?.id, fetchNotesForStory]);

  const handleNoteRelationChange = useCallback((changedStoryId: string, changedNoteRelationId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchNoteRelationsForLocation();
    }
  }, [selectedStory?.id, fetchNoteRelationsForLocation]);

  useEffect(() => {
    if (locationServiceRef.current) {
      fetchLocationDetails(); 
      fetchTagsForLocation();
      entityEventEmitter.on('location_changed', handleLocationChange);
      entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);
      entityEventEmitter.on('note_changed', handleNoteChange);
      entityEventEmitter.on('note_relation_changed', handleNoteRelationChange);

      return () => {
        entityEventEmitter.off('location_changed', handleLocationChange);
        entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
        entityEventEmitter.off('note_changed', handleNoteChange);
        entityEventEmitter.off('note_relation_changed', handleNoteRelationChange);
      };
    }
  }, [locationId, fetchLocationDetails, fetchTagsForLocation, handleLocationChange, handleTagRelationChange, handleNoteChange, handleNoteRelationChange, locationServiceRef.current]);

  useEffect(() => {
    // Fetch notes and note relations when location is loaded or changes
    if (location) {
      fetchNotesForStory(); // Fetch all notes
      fetchNoteRelationsForLocation(); // Fetch note relations
    }
  }, [location, fetchNotesForStory, fetchNoteRelationsForLocation]);

  const handleSaveNoteRelation = async (relation: NoteRelation) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await noteRelationServiceRef.current.saveNoteRelation(userId, relation);
      setLocationNoteRelations(prev => {
        const existingIndex = prev.findIndex(r => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        } else {
          return [...prev, savedRelation];
        }
      });
      entityEventEmitter.emit('note_relation_changed', selectedStory.id, locationId);
      Alert.alert(t('success'), t('note_relation_saved_successfully'));
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_save_note_relation'));
      console.error('Failed to save note relation:', error);
    }
  };

  const handleDeleteNoteRelation = async (relationId: string) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await noteRelationServiceRef.current.deleteNoteRelation(userId, relationId);
      if (success) {
        setLocationNoteRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('note_relation_changed', selectedStory.id, locationId);
        Alert.alert(t('success'), t('note_relation_deleted_successfully'));
      } else {
        Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      console.error('Failed to delete note relation:', error);
    }
  };

  const styles = StyleSheet.create({
    scrollViewContent: {
      padding: 20,
      flexGrow: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
    detailItem: {
      marginBottom: 10,
    },
    detailLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.textSecondary,
      marginBottom: 2,
    },
    detailText: {
      fontSize: 16,
      color: colors.text,
    },
    errorText: {
      color: colors.error,
      textAlign: 'center',
      marginTop: 20,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonContainer: {
      marginTop: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 15,
      marginBottom: 5,
    },
  });

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>{t('loading_location_details')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={styles.errorText}>{t('location_not_found')}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
      <Text style={styles.title}>{location.name}</Text>

      {location.description && (
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('description')}</Text>
          <Text style={styles.detailText}>{location.description}</Text>
        </View>
      )}

      {location.climate && (
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('field_climate')}</Text>
          <Text style={styles.detailText}>{location.climate}</Text>
        </View>
      )}

      {location.culture && (
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('field_culture')}</Text>
          <Text style={styles.detailText}>{location.culture}</Text>
        </View>
      )}

      {location.politics && (
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('field_politics')}</Text>
          <Text style={styles.detailText}>{location.politics}</Text>
        </View>
      )}

      {location.extraNotes && (
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{t('extra_notes')}</Text>
          <Text style={styles.detailText}>{location.extraNotes}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
      <NoteManager
        noteRelations={locationNoteRelations}
        availableNotes={allNotes}
        onSave={handleSaveNoteRelation}
        onDelete={handleDeleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={locationId}
        currentEntityType="Location"
      />

      <View style={{ marginTop: 20 }}>
        <Text style={[styles.detailLabel, { marginBottom: 5 }]}>{t('tags_title')}</Text>
        <TagChipList tags={locationTags} />
      </View>
    </ScrollView>
  );
};

export default LocationDetailsScreen;