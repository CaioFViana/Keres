import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import CustomAttributeFields, {
  getDefaultCustomAttributeValues,
  validateRequiredCustomAttributes,
} from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import NoteManager from '@/src/components/features/notes/NoteManager'; // Import NoteManager
import LocationRelationManager from '@/src/components/features/relations/LocationRelationManager/LocationRelationManager';
import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import type { Location } from '@keres/shared/entities/Location';
import type { RouteProp } from '@react-navigation/native';
import { StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { LocationRelationSelect, LocationSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { LocationStackParamList } from '../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import type { LocationRelationService } from '../../services/storymanagement/LocationRelationService';
import { createLocationRelationService } from '../../services/storymanagement/LocationRelationService';
import { createLocationService } from '../../services/storymanagement/LocationService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import {
  commonFormStyleDefs,
  getCommonContainerStyles,
  getCommonInputStyles,
} from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { setDocumentTitle } from '../../utils/documentTitle';
import { createULID } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';

type LocationFormScreenRouteProp = RouteProp<LocationStackParamList, 'LocationForm'>;
type LocationFormScreenNavigationProp = NativeStackNavigationProp<
  LocationStackParamList,
  'LocationForm'
>;

const makePendingLocationRelation = (
  storyId: string,
  relationType: 'contains' | 'connected_to',
  locationAId: string,
  locationBId: string,
): LocationRelationSelect => ({
  id: `pending-${createULID()}`,
  storyId,
  locationAId,
  locationBId,
  relationType,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  isDeleted: false,
  deletedAt: null,
});

const LocationFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<LocationFormScreenNavigationProp>();
  const route = useRoute<LocationFormScreenRouteProp>();
  const { locationId: initialLocationId } = route.params || {};
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Location');
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const locationServiceRef = useRef<ReturnType<typeof createLocationService> | null>(null);
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const locationRelationServiceRef = useRef<LocationRelationService | null>(null);

  useEffect(() => {
    if (drizzleDb && !locationServiceRef.current) {
      locationServiceRef.current = createLocationService(drizzleDb);
    }
    if (drizzleDb && !locationRelationServiceRef.current) {
      locationRelationServiceRef.current = createLocationRelationService(drizzleDb);
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
    persistNoteRelations,
  } = useEntityRelations({ entityType: 'Location', entityId: currentLocationId });

  const customFields = useStorySchemaFields(selectedStory?.id, 'Location');
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const customDefaultsAppliedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [allLocations, setAllLocations] = useState<LocationSelect[]>([]);
  const [allLocationRelations, setAllLocationRelations] = useState<LocationRelationSelect[]>([]);
  // While the location does not exist yet, each operation becomes a synthetic relation here instead of
  // writing to the database - '' in place of the not-yet-created side. Replayed in
  // `persistPendingLocationRelations` after the main save.
  const [pendingLocationRelations, setPendingLocationRelations] = useState<
    LocationRelationSelect[]
  >([]);

  const isEditing = !!currentLocationId;
  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

  const fetchAllLocationsInStory = useCallback(async () => {
    if (!locationServiceRef.current || !selectedStory?.id) {
      setAllLocations([]);
      return;
    }
    try {
      const fetchedLocations = await locationServiceRef.current.getAllByStoryId(selectedStory.id);
      setAllLocations(fetchedLocations.filter((l) => !l.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all locations:', err);
    }
  }, [selectedStory?.id]);

  const fetchAllLocationRelationsInStory = useCallback(async () => {
    if (!locationRelationServiceRef.current || !selectedStory?.id) {
      setAllLocationRelations([]);
      return;
    }
    try {
      const fetchedRelations = await locationRelationServiceRef.current.getAllRelationsForStory(
        selectedStory.id,
      );
      setAllLocationRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch all location relations:', err);
    }
  }, [selectedStory?.id]);

  useEffect(() => {
    fetchAllLocationsInStory();
    fetchAllLocationRelationsInStory();
  }, [fetchAllLocationsInStory, fetchAllLocationRelationsInStory]);

  const handleSetParent = useCallback(
    async (newParentId: string | null) => {
      if (!currentLocationId) {
        setPendingLocationRelations((prev) => {
          const withoutParent = prev.filter(
            (r) => !(r.relationType === 'contains' && r.locationBId === ''),
          );
          return newParentId === null
            ? withoutParent
            : [
                ...withoutParent,
                makePendingLocationRelation(selectedStory?.id ?? '', 'contains', newParentId, ''),
              ];
        });
        return;
      }
      if (!locationRelationServiceRef.current || !selectedStory?.id || !userId) return;
      try {
        await locationRelationServiceRef.current.setParent(
          userId,
          selectedStory.id,
          currentLocationId,
          newParentId,
        );
        fetchAllLocationRelationsInStory();
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_save_relation'),
        );
      }
    },
    [selectedStory?.id, userId, currentLocationId, t, fetchAllLocationRelationsInStory],
  );

  const handleAddChild = useCallback(
    async (childId: string) => {
      if (!currentLocationId) {
        setPendingLocationRelations((prev) => [
          ...prev,
          makePendingLocationRelation(selectedStory?.id ?? '', 'contains', '', childId),
        ]);
        return;
      }
      if (!locationRelationServiceRef.current || !selectedStory?.id || !userId) return;
      try {
        await locationRelationServiceRef.current.setParent(
          userId,
          selectedStory.id,
          childId,
          currentLocationId,
        );
        fetchAllLocationRelationsInStory();
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_save_relation'),
        );
      }
    },
    [selectedStory?.id, userId, currentLocationId, t, fetchAllLocationRelationsInStory],
  );

  const handleAddConnection = useCallback(
    async (otherLocationId: string) => {
      if (!currentLocationId) {
        setPendingLocationRelations((prev) => [
          ...prev,
          makePendingLocationRelation(selectedStory?.id ?? '', 'connected_to', '', otherLocationId),
        ]);
        return;
      }
      if (!locationRelationServiceRef.current || !selectedStory?.id || !userId) return;
      try {
        await locationRelationServiceRef.current.addConnection(
          userId,
          selectedStory.id,
          currentLocationId,
          otherLocationId,
        );
        fetchAllLocationRelationsInStory();
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_save_relation'),
        );
      }
    },
    [selectedStory?.id, userId, currentLocationId, t, fetchAllLocationRelationsInStory],
  );

  const handleRemoveLocationRelation = useCallback(
    async (relationId: string) => {
      if (!currentLocationId) {
        setPendingLocationRelations((prev) => prev.filter((r) => r.id !== relationId));
        return;
      }
      if (!locationRelationServiceRef.current || !userId) return;
      try {
        await locationRelationServiceRef.current.removeRelation(userId, relationId);
        fetchAllLocationRelationsInStory();
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_remove_relation'),
        );
      }
    },
    [userId, t, fetchAllLocationRelationsInStory, currentLocationId],
  );

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(formTitle);
      navigation.getParent()?.setOptions({
        title: formTitle,
        headerRight: () => <View />,
      });
    }, [navigation, formTitle]),
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

            const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(
              currentLocationId!,
            );
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
  }, [currentLocationId, drizzleDb, isEditing, selectedStory?.id, t]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const handleSave = async () => {
    if (!name.trim()) {
      AppAlert.alert(t('error'), t('name_required'));
      return;
    }
    const missingRequiredField = validateRequiredCustomAttributes(customFields, customValues);
    if (missingRequiredField) {
      AppAlert.alert(t('error'), t('custom_attribute_required', { field: missingRequiredField }));
      return;
    }
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!selectedStory?.id) {
      AppAlert.alert(t('error'), t('no_story_selected'));
      return;
    }

    setLoading(true);

    try {
      const locationData: Omit<
        Location,
        'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      > = {
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
        savedLocation = await locationServiceRef.current!.updateLocation(
          userId,
          currentLocationId!,
          locationData,
        );
        AppAlert.alert(t('success'), copy.updated);
      } else {
        savedLocation = await locationServiceRef.current!.createLocation(userId, {
          ...locationData,
          storyId: selectedStory.id,
        });
        AppAlert.alert(t('success'), copy.created);
        setCurrentLocationId(savedLocation.id);
      }

      if (savedLocation.id) {
        await persistTagRelations(savedLocation.id);
        await persistNoteRelations(savedLocation.id);
        await seeAlsoManagerRef.current?.persistPending(savedLocation.id);
        await persistPendingLocationRelations(savedLocation.id);
        await createAttributeValueService(drizzleDb).saveValuesForEntity(
          userId,
          selectedStory.id,
          'Location',
          savedLocation.id,
          customValues,
        );
      }

      entityEventEmitter.emit('location_changed', selectedStory.id, savedLocation.id);

      if (!isEditing && savedLocation.id) {
        navigation.dispatch(StackActions.replace('LocationForm', { locationId: savedLocation.id }));
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('Failed to save location:', err);
      AppAlert.alert(t('error'), copy.failedToSave);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    if (!currentLocationId || !locationServiceRef.current) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_location_title',
      title: copy.deleteLabel,
      messageKey: 'delete_location_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_location',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setLoading,
      onConfirm: async () => {
        await locationServiceRef.current!.deleteLocation(userId, currentLocationId);
        entityEventEmitter.emit('location_changed', selectedStory?.id, currentLocationId);
        navigation.goBack();
      },
    });
  };

  /**
   * Actually saves the relations accumulated while the location did not exist yet - '' in place of the
   * not-yet-created side (see `makePendingLocationRelation`); it swaps in the real id here.
   */
  const persistPendingLocationRelations = async (targetLocationId: string) => {
    if (!locationRelationServiceRef.current || !selectedStory?.id || !userId) return;
    for (const pending of pendingLocationRelations) {
      if (pending.relationType === 'contains') {
        if (pending.locationAId === '') {
          await locationRelationServiceRef.current.setParent(
            userId,
            selectedStory.id,
            pending.locationBId,
            targetLocationId,
          );
        } else {
          await locationRelationServiceRef.current.setParent(
            userId,
            selectedStory.id,
            targetLocationId,
            pending.locationAId,
          );
        }
      } else {
        const otherId = pending.locationAId === '' ? pending.locationBId : pending.locationAId;
        await locationRelationServiceRef.current.addConnection(
          userId,
          selectedStory.id,
          targetLocationId,
          otherId,
        );
      }
    }
    if (pendingLocationRelations.length > 0) {
      setPendingLocationRelations([]);
      fetchAllLocationRelationsInStory();
    }
  };

  const handleTagSelectionChange = useCallback(
    (newSelection: string[]) => {
      setSelectedTagIds(newSelection);
    },
    [setSelectedTagIds],
  );

  const styles = StyleSheet.create({
    ...commonFormStyleDefs(colors, scrollBottomPadding),
    tagSection: {
      marginTop: 20,
      marginBottom: 0,
    },
    noteSection: {
      // Renamed from tagSection for clarity.
      marginTop: 20,
      marginBottom: -10,
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
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.scrollViewContent}
    >
      <Text style={[styles.title, { color: colors.text }]}>{formTitle}</Text>
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
        value={description || ''}
        onChangeText={setDescription}
        style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
        multiline
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('field_climate')}</Text>
      <TextInput
        placeholder={t('climate_placeholder')}
        value={climate || ''}
        onChangeText={setClimate}
        style={commonInputStyles.input}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('field_culture')}</Text>
      <TextInput
        placeholder={t('culture_placeholder')}
        value={culture || ''}
        onChangeText={setCulture}
        style={commonInputStyles.input}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('field_politics')}</Text>
      <TextInput
        placeholder={t('politics_placeholder')}
        value={politics || ''}
        onChangeText={setPolitics}
        style={commonInputStyles.input}
      />

      <View style={styles.switchContainer}>
        <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5 }]}>
          {t('is_favorite')}
        </Text>
        <ThemedSwitch
          value={isFavorite}
          onValueChange={setIsFavorite}
          style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
        />
      </View>

      <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
      <TextInput
        placeholder={t('extra_notes_placeholder')}
        value={extraNotes || ''}
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
        <MultiSelectPill
          options={availableTags.map((tag) => ({
            label: tag.name,
            value: tag.id,
            color: tag.color || colors.primaryContainer,
          }))}
          selectedValues={selectedTagIds}
          onSelectionChange={handleTagSelectionChange}
          placeholder={t('select_tags_for_location')}
          label={t('location_tags')}
        />
      </View>

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <NoteManager
            noteRelations={locationNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentLocationId ?? ''}
            currentEntityType="Location"
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <LocationRelationManager
            currentLocationId={currentLocationId ?? ''}
            allLocations={allLocations}
            allLocationRelations={
              currentLocationId ? allLocationRelations : pendingLocationRelations
            }
            onSetParent={handleSetParent}
            onAddChild={handleAddChild}
            onAddConnection={handleAddConnection}
            onRemoveRelation={handleRemoveLocationRelation}
            editable={true}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="Location"
            entityId={currentLocationId ?? ''}
            editable={true}
          />
        </View>
      )}

      <FormActions stackOnCompact style={styles.saveButton}>
        <Button onPress={handleSave}>{copy.saveLabel}</Button>
        {isEditing && (
          <Button onPress={handleDelete} style={{ backgroundColor: colors.error }}>
            {copy.deleteLabel}
          </Button>
        )}
      </FormActions>
    </KeyboardAwareScreen>
  );
};

export default LocationFormScreen;
