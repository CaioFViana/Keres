import TextInput from '@/src/components/common/TextInput/TextInput';
import { Location } from '@keres/shared/entities/Location';
import { RouteProp, useFocusEffect, useNavigation, useRoute, StackActions } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import MultiSelectPill from '../../components/common/MultiSelectPill/MultiSelectPill';
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { LocationStackParamList } from '../../navigation/MainSystemStack';
import { createLocationService } from '../../services/LocationService';
import { createTagRelationService } from '../../services/TagRelationService';
import { createTagService } from '../../services/TagService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';


type LocationFormScreenRouteProp = RouteProp<LocationStackParamList, 'LocationForm'>;
type LocationFormScreenNavigationProp = NativeStackNavigationProp<LocationStackParamList, 'LocationForm'>;

const LocationFormScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<LocationFormScreenNavigationProp>();
  const route = useRoute<LocationFormScreenRouteProp>();
  const { locationId: initialLocationId } = route.params || {};
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const locationServiceRef = useRef<ReturnType<typeof createLocationService> | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);

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

  const [currentLocationId, setCurrentLocationId] = useState<string | undefined>(initialLocationId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState<string | null>(null);
  const [climate, setClimate] = useState<string | null>(null);
  const [culture, setCulture] = useState<string | null>(null);
  const [politics, setPolitics] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  const [availableTags, setAvailableTags] = useState<TagSelect[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!currentLocationId;

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_location_title') : t('create_location_title'),
        headerRight: () => {<View/>}
      });
    }, [navigation, isEditing, t])
  );

  const fetchAvailableTags = useCallback(async () => {
    if (!tagServiceRef.current || !selectedStory?.id) {
      setAvailableTags([]);
      return;
    }
    try {
      const fetchedTags = await tagServiceRef.current.getTagsByStoryId(selectedStory.id);
      setAvailableTags(fetchedTags);
    } catch (err) {
      console.error('Failed to fetch available tags:', err);
    }
  }, [selectedStory?.id, tagServiceRef.current]);

  const fetchLocationTags = useCallback(async () => {
    if (!tagRelationServiceRef.current || !selectedStory?.id || !currentLocationId) {
      setSelectedTagIds([]);
      return;
    }
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(selectedStory.id, currentLocationId, 'Location');
      setSelectedTagIds(fetchedTags.map(tag => tag.id));
    } catch (err) {
      console.error('Failed to fetch location tags:', err);
    }
  }, [selectedStory?.id, currentLocationId, tagRelationServiceRef.current]);

  useEffect(() => {
    const loadLocationAndTags = async () => {
      if (!locationServiceRef.current) {
        console.warn('Location service not initialized.');
        return;
      }

      if (!isEditing) {
        setLoading(false);
        fetchAvailableTags();
        return;
      }
      try {
        setLoading(true);
        const fetchedLocation = await locationServiceRef.current.getById(currentLocationId!);
        if (fetchedLocation) {
          setName(fetchedLocation.name);
          setDescription(fetchedLocation.description);
          setClimate(fetchedLocation.climate);
          setCulture(fetchedLocation.culture);
          setPolitics(fetchedLocation.politics);
          setIsFavorite(fetchedLocation.isFavorite);
          setExtraNotes(fetchedLocation.extraNotes);
        } else {
          setError(t('location_not_found'));
        }
      } catch (err) {
        console.error('Failed to load location:', err);
        setError(t('failed_to_load_location'));
      } finally {
        setLoading(false);
        fetchAvailableTags();
        fetchLocationTags();
      }
    };
    loadLocationAndTags();
  }, [currentLocationId, isEditing, locationServiceRef.current, t, fetchAvailableTags, fetchLocationTags]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('name_required'));
      return;
    }
    if (!userId) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!selectedStory?.id) {
      Alert.alert(t('error'), t('no_story_selected'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const locationData: Omit<Location, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'> = {
        name: name.trim(),
        description,
        climate,
        culture,
        politics,
        isFavorite,
        extraNotes,
      };

      let savedLocation: Location;

      if (isEditing) {
        savedLocation = await locationServiceRef.current!.updateLocation(userId, currentLocationId!, locationData);
        Alert.alert(t('success'), t('location_updated_successfully'));
      } else {
        savedLocation = await locationServiceRef.current!.createLocation(userId, { ...locationData, storyId: selectedStory.id });
        Alert.alert(t('success'), t('location_created_successfully'));
        setCurrentLocationId(savedLocation.id);
      }

      if (savedLocation.id && tagRelationServiceRef.current && selectedStory?.id) {
        await tagRelationServiceRef.current.updateTagsForEntity(userId, selectedStory.id, savedLocation.id, 'Location', selectedTagIds);
      }
      
      entityEventEmitter.emit('location_changed', selectedStory.id, savedLocation.id);

      if (!isEditing && savedLocation.id) {
        navigation.dispatch(StackActions.replace('LocationForm', { locationId: savedLocation.id }));
      } else {
        navigation.goBack();
      }

    } catch (err) {
      console.error('Failed to save location:', err);
      setError(t('failed_to_save_location'));
      Alert.alert(t('error'), t('failed_to_save_location'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!userId) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }

    Alert.alert(
      t('delete_location_title'),
      t('delete_location_message'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('delete'),
          onPress: async () => {
            if (currentLocationId && locationServiceRef.current) {
              try {
                setLoading(true);
                await locationServiceRef.current.deleteLocation(userId, currentLocationId);
                entityEventEmitter.emit('location_changed', selectedStory?.id, currentLocationId);
                Alert.alert(t('success'), t('location_deleted_successfully'));
                navigation.goBack();
              } catch (err) {
                console.error('Failed to delete location:', err);
                setError(t('failed_to_delete_location'));
                Alert.alert(t('error'), t('failed_to_delete_location'));
              } finally {
                setLoading(false);
              }
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  const handleTagSelectionChange = useCallback((newSelection: string[]) => {
    setSelectedTagIds(newSelection);
  }, []);

  const styles = StyleSheet.create({
    scrollViewContent: {
      padding: 20,
      paddingBottom: 350,
      flexGrow: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 5,
    },
    label: {
      fontSize: 16,
      fontWeight: 'bold',
      marginTop: 15,
      marginBottom: 5,
    },
    switchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 15,
      marginBottom: 5,
    },
    saveButton: {
      marginTop: 20,
      marginBottom: 0,
    },
    deleteButton: {
      backgroundColor: 'red',
      marginBottom: 15
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tagSection: {
      marginTop: 20,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <Text style={[styles.title, { color: colors.text }]}>{isEditing ? t('edit_location_title') : t('create_location_title')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
            {t('location_form_description')}
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>{t('name')}</Text>
          <TextInput
            placeholder={t('name_placeholder')}
            value={name}
            onChangeText={setName}
            style={commonInputStyles.input}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('description')}</Text>
          <TextInput
            placeholder={t('description_placeholder')}
            value={description || ""}
            onChangeText={setDescription}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('field_climate')}</Text>
          <TextInput
            placeholder={t('climate_placeholder')}
            value={climate || ""}
            onChangeText={setClimate}
            style={commonInputStyles.input}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('field_culture')}</Text>
          <TextInput
            placeholder={t('culture_placeholder')}
            value={culture || ""}
            onChangeText={setCulture}
            style={commonInputStyles.input}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('field_politics')}</Text>
          <TextInput
            placeholder={t('politics_placeholder')}
            value={politics || ""}
            onChangeText={setPolitics}
            style={commonInputStyles.input}
          />

          <View style={styles.switchContainer}>
            <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5}]}>{t('is_favorite')}</Text>
            <Switch
              value={isFavorite}
              onValueChange={setIsFavorite}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isFavorite ? colors.onPrimary : colors.textSecondary}
              style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
            />
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
          <TextInput
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ""}
            onChangeText={setExtraNotes}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <View style={styles.tagSection}>
            <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
            <MultiSelectPill
              options={availableTags.map(tag => ({ label: tag.name, value: tag.id, color: tag.color || colors.primaryContainer }))}
              selectedValues={selectedTagIds}
              onSelectionChange={handleTagSelectionChange}
              placeholder={t('select_tags_for_location')}
              label={t('location_tags')}
            />
          </View>

          <Button onPress={handleSave} style={styles.saveButton}>
            {t('save_location')}
          </Button>

          {isEditing && (
            <Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>
              {t('delete_location_title')}
            </Button>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>
      </TouchableWithoutFeedback>    
    </KeyboardAvoidingView>
  );
};

export default LocationFormScreen;
