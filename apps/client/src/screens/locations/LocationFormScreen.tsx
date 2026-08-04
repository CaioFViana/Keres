import TextInput from '@/src/components/common/TextInput/TextInput';
import { Location } from '@keres/shared/entities/Location';
import { RouteProp, StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import CustomAttributeFields, { CustomAttributeValues, getDefaultCustomAttributeValues, validateRequiredCustomAttributes } from '../../components/common/CustomAttributeFields/CustomAttributeFields';
import MultiSelectPill from '../../components/common/MultiSelectPill/MultiSelectPill';
import NoteManager from '../../components/NoteManager'; // Import NoteManager
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import { LocationStackParamList } from '../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { createLocationService } from '../../services/storymanagement/LocationService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';


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

  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const locationServiceRef = useRef<ReturnType<typeof createLocationService> | null>(null);

  useEffect(() => {
    if (drizzleDb && !locationServiceRef.current) {
      locationServiceRef.current = createLocationService(drizzleDb);
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

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    allNotes,
    noteRelations: locationNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Location', entityId: currentLocationId });

  const customFields = useStorySchemaFields(selectedStory?.id, 'Location');
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const customDefaultsAppliedRef = useRef(false);

  const [loading, setLoading] = useState(true);

  const isEditing = !!currentLocationId;

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_location_title') : t('create_location_title'),
        headerRight: () => <View/>
      });
    }, [navigation, isEditing, t])
  );

  useEffect(() => {
    const loadLocation = async () => {
      if (!locationServiceRef.current || !selectedStory?.id) {
        console.warn('Location service or selected story not available.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (isEditing) {
          const fetchedLocation = await locationServiceRef.current.getById(currentLocationId!);
          if (fetchedLocation) {
            setName(fetchedLocation.name);
            setDescription(fetchedLocation.description);
            setClimate(fetchedLocation.climate);
            setCulture(fetchedLocation.culture);
            setPolitics(fetchedLocation.politics);
            setIsFavorite(fetchedLocation.isFavorite);
            setExtraNotes(fetchedLocation.extraNotes);

            const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(currentLocationId!);
            setCustomValues(Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value])));
          } else {
            console.warn('Location not found:', currentLocationId);
          }
        }
      } catch (err) {
        console.error('Failed to load location:', err);
      } finally {
        setLoading(false);
      }
    };
    loadLocation();
  }, [currentLocationId, isEditing, selectedStory?.id, t]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('name_required'));
      return;
    }
    const missingRequiredField = validateRequiredCustomAttributes(customFields, customValues);
    if (missingRequiredField) {
      Alert.alert(t('error'), t('custom_attribute_required', { field: missingRequiredField }));
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

      if (savedLocation.id) {
        await persistTagRelations(savedLocation.id);
        await createAttributeValueService(drizzleDb).saveValuesForEntity(userId, selectedStory.id, 'Location', savedLocation.id, customValues);
      }


      entityEventEmitter.emit('location_changed', selectedStory.id, savedLocation.id);

      if (!isEditing && savedLocation.id) {
        navigation.dispatch(StackActions.replace('LocationForm', { locationId: savedLocation.id }));
      } else {
        navigation.goBack();
      }

    } catch (err) {
      console.error('Failed to save location:', err);
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

    if (!currentLocationId || !locationServiceRef.current) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_location_title',
      messageKey: 'delete_location_message',
      successKey: 'location_deleted_successfully',
      failureKey: 'failed_to_delete_location',
      onLoadingChange: setLoading,
      onConfirm: async () => {
        await locationServiceRef.current!.deleteLocation(userId, currentLocationId);
        entityEventEmitter.emit('location_changed', selectedStory?.id, currentLocationId);
        navigation.goBack();
      },
    });
  };

  const handleTagSelectionChange = useCallback((newSelection: string[]) => {
    setSelectedTagIds(newSelection);
  }, [setSelectedTagIds]);

  const styles = StyleSheet.create({
    scrollViewContent: {
      padding: 20,
      paddingBottom: scrollBottomPadding,
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

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.text }}>{t('loading')}...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

          <CustomAttributeFields
            storyId={selectedStory?.id || ''}
            fields={customFields}
            values={customValues}
            onChange={(fieldId, value) => setCustomValues((prev) => ({ ...prev, [fieldId]: value }))}
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

          {currentLocationId && selectedStory?.id && (
            <View style={styles.tagSection}>
              <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
              <NoteManager
                noteRelations={locationNoteRelations}
                availableNotes={allNotes}
                onSave={saveNoteRelation}
                onDelete={deleteNoteRelation}
                editable={true}
                currentStoryId={selectedStory.id}
                currentEntityId={currentLocationId}
                currentEntityType="Location"
              />
            </View>
          )}

          <Button onPress={handleSave} style={styles.saveButton}>
            {t('save_location')}
          </Button>

          {isEditing && (
            <Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>
              {t('delete_location_title')}
            </Button>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>    
    </KeyboardAvoidingView>
  );
};

export default LocationFormScreen;
