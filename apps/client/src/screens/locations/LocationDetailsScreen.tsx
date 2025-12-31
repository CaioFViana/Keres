import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import TagChipList from '../../components/common/TagChipList/TagChipList';

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

  const [location, setLocation] = useState<LocationSelect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationTags, setLocationTags] = useState<TagSelect[]>([]);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

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

  useEffect(() => {
    if (locationServiceRef.current) {
      fetchLocationDetails(); 
      fetchTagsForLocation();
      entityEventEmitter.on('location_changed', handleLocationChange);
      entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);

      return () => {
        entityEventEmitter.off('location_changed', handleLocationChange);
        entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
      };
    }
  }, [locationId, fetchLocationDetails, fetchTagsForLocation, handleLocationChange, handleTagRelationChange, locationServiceRef.current]);

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

      <View style={{ marginTop: 20 }}>
        <Text style={[styles.detailLabel, { marginBottom: 5 }]}>{t('tags_title')}</Text>
        <TagChipList tags={locationTags} />
      </View>
    </ScrollView>
  );
};

export default LocationDetailsScreen;