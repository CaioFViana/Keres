import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import CustomAttributeFields, {
  getDefaultCustomAttributeValues,
  validateRequiredCustomAttributes,
} from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import Select from '@/src/components/common/inputs/Select/Select'; // Import Select component
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import SceneCharacterManager from '@/src/components/features/characters/CharacterManager/SceneCharacterManager';
import ScenePlotManager from '@/src/components/features/plots/ScenePlotManager/ScenePlotManager';
import NoteManager from '@/src/components/features/notes/NoteManager';
import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import type { CharacterScene } from '@keres/shared/entities/CharacterScene'; // Import CharacterScene entity
import type { Effect } from '@keres/shared/entities/Effect';
import type { Plot } from '@keres/shared/entities/Plot';
import type { PlotScene } from '@keres/shared/entities/PlotScene';
import type { Scene } from '@keres/shared/entities/Scene';
import type { RouteProp } from '@react-navigation/native';
import { StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'; // Added useMemo
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../../db';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../../hooks/useFormScrollBottomPadding';
import { useStorySchemaFields } from '../../../hooks/useStorySchemaFields';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../../services/storymanagement/AttributeValueService';
import type { CharacterSceneServiceInterface } from '../../../services/storymanagement/CharacterSceneService';
import { createCharacterSceneService } from '../../../services/storymanagement/CharacterSceneService'; // Import CharacterSceneService
import { createEffectService } from '../../../services/storymanagement/EffectService';
import { createLocationService } from '../../../services/storymanagement/LocationService'; // Import LocationService
import { createPlotSceneService } from '../../../services/storymanagement/PlotSceneService';
import { createPlotService } from '../../../services/storymanagement/PlotService';
import { createSceneService } from '../../../services/storymanagement/SceneService';
import { useChapterStore } from '../../../state/chapterStore'; // Import useChapterStore
import { useCharacterStore } from '../../../state/characterStore'; // Import useCharacterStore
import { useItemStore } from '../../../state/itemStore';
import { useLocationStore } from '../../../state/locationStore'; // Import useLocationStore
import { useStoryStore } from '../../../state/storyStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { useTheme } from '../../../theme';
import {
  commonFormStyleDefs,
  getCommonContainerStyles,
  getCommonInputStyles,
} from '../../../theme/commonStyles';
import { AppAlert } from '../../../utils/AppAlert';
import { setDocumentTitle } from '../../../utils/documentTitle';
import { entityEventEmitter } from '../../../utils/EventEmitter';

type SceneFormScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'SceneForm'>;
type SceneFormScreenNavigationProp = NativeStackNavigationProp<
  NarrativeElementsStackParamList,
  'SceneForm'
>;

const isTimingInput = (value: string) => /^-?\d*$/.test(value);
const MAX_SCENE_TIMING = 2147483647;
const parseTimingInput = (value: string): number | null => {
  if (!value || value === '-') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && Math.abs(parsed) <= MAX_SCENE_TIMING ? parsed : null;
};

const SceneFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<SceneFormScreenNavigationProp>();
  const route = useRoute<SceneFormScreenRouteProp>();
  const { sceneId: initialSceneId, chapterId: initialChapterId } = route.params || {};
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const {
    chapters,
    fetchChapters,
    setDbAndStoryId: setChapterDbAndStoryId,
    initializeService: initializeChapterService,
  } = useChapterStore(); // For chapter selection
  const {
    locations,
    fetchLocations,
    setDbAndStoryId: setLocationDbAndStoryId,
    initializeService: initializeLocationService,
  } = useLocationStore(); // For location selection
  const {
    characters,
    fetchCharacters,
    setDbAndStoryId: setCharacterDbAndStoryId,
    initializeService: initializeCharacterService,
  } = useCharacterStore(); // For character selection
  const {
    items,
    fetchItems,
    setDbAndStoryId: setItemDbAndStoryId,
    initializeService: initializeItemService,
  } = useItemStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const sceneServiceRef = useRef<ReturnType<typeof createSceneService> | null>(null);
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const locationServiceRef = useRef<ReturnType<typeof createLocationService> | null>(null); // Ref for LocationService
  const characterSceneServiceRef = useRef<CharacterSceneServiceInterface | null>(null); // Ref for CharacterSceneService
  const effectServiceRef = useRef<ReturnType<typeof createEffectService> | null>(null);
  const plotServiceRef = useRef<ReturnType<typeof createPlotService> | null>(null);
  const plotSceneServiceRef = useRef<ReturnType<typeof createPlotSceneService> | null>(null);

  const isBranching = selectedStory?.type === 'branching';

  useEffect(() => {
    if (drizzleDb) {
      if (!sceneServiceRef.current) {
        sceneServiceRef.current = createSceneService(drizzleDb);
      }
      if (!locationServiceRef.current) {
        locationServiceRef.current = createLocationService(drizzleDb); // Initialize LocationService
      }
      if (!characterSceneServiceRef.current) {
        characterSceneServiceRef.current = createCharacterSceneService(drizzleDb); // Initialize CharacterSceneService
      }
      if (!effectServiceRef.current) {
        effectServiceRef.current = createEffectService(drizzleDb);
      }
      if (!plotServiceRef.current) plotServiceRef.current = createPlotService(drizzleDb);
      if (!plotSceneServiceRef.current)
        plotSceneServiceRef.current = createPlotSceneService(drizzleDb);
    }
  }, [drizzleDb]);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setItemDbAndStoryId(drizzleDb, selectedStory.id);
      initializeItemService();
      fetchItems();
    }
  }, [drizzleDb, selectedStory?.id, setItemDbAndStoryId, initializeItemService, fetchItems]);

  // Initialize Chapter Service and fetch chapters
  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setChapterDbAndStoryId(drizzleDb, selectedStory.id);
      initializeChapterService();
      fetchChapters();
    }
  }, [
    drizzleDb,
    selectedStory?.id,
    setChapterDbAndStoryId,
    initializeChapterService,
    fetchChapters,
  ]);

  // Initialize Location Service and fetch locations
  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setLocationDbAndStoryId(drizzleDb, selectedStory.id);
      initializeLocationService();
      fetchLocations();
    }
  }, [
    drizzleDb,
    selectedStory?.id,
    setLocationDbAndStoryId,
    initializeLocationService,
    fetchLocations,
  ]);

  // Initialize Character Service and fetch characters
  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setCharacterDbAndStoryId(drizzleDb, selectedStory.id);
      initializeCharacterService();
      fetchCharacters();
    }
  }, [
    drizzleDb,
    selectedStory?.id,
    setCharacterDbAndStoryId,
    initializeCharacterService,
    fetchCharacters,
  ]);

  const [currentSceneId, setCurrentSceneId] = useState<string | undefined>(initialSceneId);
  const [chapterId, setChapterId] = useState<string | null>(null); // State for selected chapter
  const [locationId, setLocationId] = useState<string | null>(null); // State for selected location
  const [name, setName] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [gapInput, setGapInput] = useState('');
  const [gapType, setGapType] = useState<string | null>(null); // e.g., 'seconds', 'minutes', 'hours'
  const [durationInput, setDurationInput] = useState('');
  const [durationType, setDurationType] = useState<string | null>(null); // e.g., 'seconds', 'minutes', 'hours'
  const [isStart, setIsStart] = useState(false);
  const [isFinish, setIsFinish] = useState(false);

  const [characterSceneRelations, setCharacterSceneRelations] = useState<CharacterScene[]>([]); // State for character-scene relations
  const [sceneEffects, setSceneEffects] = useState<Effect[]>([]);
  // While the scene does not exist yet, present characters stay here instead of being written to the database -
  // `sceneId: ''` until the replay in `persistPendingCharacterSceneRelations` after the main save.
  const [pendingCharacterSceneRelations, setPendingCharacterSceneRelations] = useState<
    CharacterScene[]
  >([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [plotSceneRelations, setPlotSceneRelations] = useState<PlotScene[]>([]);
  const [pendingPlotSceneRelations, setPendingPlotSceneRelations] = useState<PlotScene[]>([]);

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    allNotes,
    noteRelations: sceneNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
  } = useEntityRelations({ entityType: 'Scene', entityId: currentSceneId });

  const customFields = useStorySchemaFields(selectedStory?.id, 'Scene');
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const customDefaultsAppliedRef = useRef(false);

  const [loading, setLoading] = useState(true);

  const isEditing = !!currentSceneId;

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(isEditing ? t('edit_scene_title') : t('create_scene_title'));
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_scene_title') : t('create_scene_title'),
        headerRight: () => <View />,
      });
    }, [navigation, isEditing, t]),
  );

  const fetchCharacterSceneRelations = useCallback(async () => {
    if (!characterSceneServiceRef.current || !selectedStory?.id || !currentSceneId) {
      setCharacterSceneRelations([]);
      return;
    }
    try {
      const fetchedRelations = await characterSceneServiceRef.current.getRelationsForScene(
        selectedStory.id,
        currentSceneId,
      );
      setCharacterSceneRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch character-scene relations:', err);
    }
  }, [selectedStory?.id, currentSceneId]);

  const fetchPlotData = useCallback(async () => {
    if (
      !selectedStory?.id ||
      isBranching ||
      !plotServiceRef.current ||
      !plotSceneServiceRef.current
    ) {
      setPlots([]);
      setPlotSceneRelations([]);
      return;
    }
    const [availablePlots, relations] = await Promise.all([
      plotServiceRef.current.getAllByStoryId(selectedStory.id),
      currentSceneId
        ? plotSceneServiceRef.current.getBySceneId(selectedStory.id, currentSceneId)
        : Promise.resolve([]),
    ]);
    setPlots(availablePlots);
    setPlotSceneRelations(relations);
  }, [currentSceneId, isBranching, selectedStory?.id]);

  const fetchSceneEffects = useCallback(async () => {
    if (!effectServiceRef.current || !selectedStory?.id || !currentSceneId) {
      setSceneEffects([]);
      return;
    }
    try {
      const fetchedEffects = await effectServiceRef.current.getEffectsByEntity(
        selectedStory.id,
        'Scene',
        currentSceneId,
      );
      setSceneEffects(fetchedEffects);
    } catch (err) {
      console.error('Failed to fetch scene effects:', err);
    }
  }, [selectedStory?.id, currentSceneId]);

  useEffect(() => {
    if (isBranching) {
      fetchSceneEffects();
    }
  }, [isBranching, fetchSceneEffects]);

  const handleAddEffect = async () => {
    if (!userId || !selectedStory?.id || !currentSceneId || !effectServiceRef.current) {
      return;
    }
    try {
      const newEffect = await effectServiceRef.current.createEffect(userId, {
        storyId: selectedStory.id,
        entityType: 'Scene',
        entityId: currentSceneId,
        effectType: 'itemGrant',
        itemId: null,
        triggerName: null,
      });
      setSceneEffects((prev) => [...prev, newEffect]);
      entityEventEmitter.emit('effect_changed', selectedStory.id, currentSceneId);
    } catch (err) {
      console.error('Failed to add effect:', err);
      AppAlert.alert(t('error'), t('failed_to_save_effect'));
    }
  };

  const handleUpdateEffect = async (
    effectId: string,
    changes: Partial<
      Omit<
        Effect,
        | 'id'
        | 'storyId'
        | 'entityType'
        | 'entityId'
        | 'createdAt'
        | 'updatedAt'
        | 'version'
        | 'isDeleted'
        | 'deletedAt'
      >
    >,
  ) => {
    if (!userId || !effectServiceRef.current) {
      return;
    }
    try {
      const updatedEffect = await effectServiceRef.current.updateEffect(userId, effectId, changes);
      setSceneEffects((prev) =>
        prev.map((effect) => (effect.id === effectId ? updatedEffect : effect)),
      );
      entityEventEmitter.emit('effect_changed', selectedStory?.id, currentSceneId);
    } catch (err) {
      console.error('Failed to update effect:', err);
      AppAlert.alert(t('error'), t('failed_to_save_effect'));
    }
  };

  const handleChangeEffectType = (effectId: string, effectType: Effect['effectType']) => {
    handleUpdateEffect(effectId, { effectType, itemId: null, triggerName: null });
  };

  const handleDeleteEffect = async (effectId: string) => {
    if (!userId || !effectServiceRef.current) {
      return;
    }
    try {
      await effectServiceRef.current.deleteEffect(userId, effectId);
      setSceneEffects((prev) => prev.filter((effect) => effect.id !== effectId));
      entityEventEmitter.emit('effect_changed', selectedStory?.id, currentSceneId);
    } catch (err) {
      console.error('Failed to delete effect:', err);
      AppAlert.alert(t('error'), t('failed_to_delete_effect'));
    }
  };

  useEffect(() => {
    const loadSceneAndData = async () => {
      if (!sceneServiceRef.current || !selectedStory?.id) {
        console.warn('Scene service or selected story not available.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (isEditing) {
          const fetchedScene = await sceneServiceRef.current.getById(currentSceneId!);
          if (fetchedScene) {
            setChapterId(fetchedScene.chapterId);
            setLocationId(fetchedScene.locationId); // Set locationId
            setName(fetchedScene.name);
            setSummary(fetchedScene.summary);
            setIsFavorite(fetchedScene.isFavorite);
            setExtraNotes(fetchedScene.extraNotes);
            setGapInput(fetchedScene.gap === null ? '' : String(fetchedScene.gap));
            setGapType(fetchedScene.gapType);
            setDurationInput(fetchedScene.duration === null ? '' : String(fetchedScene.duration));
            setDurationType(fetchedScene.durationType);
            setIsStart(fetchedScene.isStart);
            setIsFinish(fetchedScene.isFinish);

            const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(
              currentSceneId!,
            );
            setCustomValues(Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value])));
          } else {
            console.warn('Scene not found:', currentSceneId);
          }
        } else if (initialChapterId) {
          setChapterId(initialChapterId);
        }
      } catch (err) {
        console.error('Failed to load scene:', err);
      } finally {
        setLoading(false);
        fetchCharacterSceneRelations(); // Fetch character-scene relations
        fetchPlotData();
      }
    };
    loadSceneAndData();
  }, [
    currentSceneId,
    drizzleDb,
    fetchCharacterSceneRelations,
    fetchPlotData,
    initialChapterId,
    isEditing,
    selectedStory?.id,
    t,
  ]);

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

    const gap = parseTimingInput(gapInput);
    const duration = parseTimingInput(durationInput);
    if ((gapInput !== '' && gap === null) || (durationInput !== '' && duration === null)) {
      AppAlert.alert(t('error'), t('scene_timing_invalid'));
      return;
    }

    setLoading(true);

    try {
      const sceneData: Omit<
        Scene,
        | 'id'
        | 'storyId'
        | 'createdAt'
        | 'updatedAt'
        | 'version'
        | 'isDeleted'
        | 'deletedAt'
        | 'index'
      > = {
        chapterId: chapterId,
        locationId: locationId,
        name: name.trim(),
        summary,
        isFavorite,
        extraNotes,
        gap,
        gapType,
        duration,
        durationType,
        isStart,
        isFinish,
      };

      let savedSceneId: string | undefined = currentSceneId;

      if (isEditing && currentSceneId) {
        const originalScene = await sceneServiceRef.current!.getById(currentSceneId);
        if (!originalScene) {
          throw new Error(t('scene_not_found'));
        }

        // Changing chapter (the position in the new queue and closing the hole in the old one) is the
        // service's responsibility: here the screen only says which chapter the scene is going to.
        const savedScene = await sceneServiceRef.current!.updateScene(
          userId,
          currentSceneId,
          sceneData,
        );
        savedSceneId = savedScene.id;
        AppAlert.alert(t('success'), t('scene_updated_successfully'));
      } else {
        // --- CREATE NEW SCENE LOGIC ---
        const allScenesInChapter = (
          await sceneServiceRef.current!.getAllByStoryId(selectedStory.id)
        ).filter((scn) => scn.chapterId === chapterId);
        // A chapter's first scene is 1, and not 0: the same convention as the chapters and the only one
        // the API accepts when those scenes are reordered later.
        const nextIndex =
          allScenesInChapter.length > 0
            ? Math.max(...allScenesInChapter.map((scn) => scn.index || 0)) + 1
            : 1;
        const savedScene = await sceneServiceRef.current!.createScene(userId, {
          ...sceneData,
          storyId: selectedStory.id,
          index: nextIndex,
        });
        savedSceneId = savedScene.id;
        setCurrentSceneId(savedScene.id);
        AppAlert.alert(t('success'), t('scene_created_successfully'));
      }

      if (savedSceneId) {
        await persistTagRelations(savedSceneId);
        await persistNoteRelations(savedSceneId);
        await seeAlsoManagerRef.current?.persistPending(savedSceneId);
        await persistPendingCharacterSceneRelations(savedSceneId);
        await persistPendingPlotSceneRelations(savedSceneId);
        await createAttributeValueService(drizzleDb).saveValuesForEntity(
          userId,
          selectedStory.id,
          'Scene',
          savedSceneId,
          customValues,
        );
        entityEventEmitter.emit('scene_changed', selectedStory.id, savedSceneId);
      }

      if (!isEditing && savedSceneId) {
        navigation.dispatch(StackActions.replace('SceneForm', { sceneId: savedSceneId }));
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('Failed to save scene:', err);
      AppAlert.alert(t('error'), t('failed_to_save_scene'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    if (!currentSceneId || !sceneServiceRef.current) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_scene_title',
      messageKey: 'delete_scene_message',
      successKey: 'scene_deleted_successfully',
      failureKey: 'failed_to_delete_scene',
      onLoadingChange: setLoading,
      onConfirm: async () => {
        await sceneServiceRef.current!.deleteScene(userId, currentSceneId);
        entityEventEmitter.emit('scene_changed', selectedStory?.id, currentSceneId);
        navigation.goBack();
      },
    });
  };

  const handleTagSelectionChange = useCallback(
    (newSelection: string[]) => {
      setSelectedTagIds(newSelection);
    },
    [setSelectedTagIds],
  );

  const handleSaveCharacterSceneRelation = async (relation: CharacterScene) => {
    if (!currentSceneId) {
      setPendingCharacterSceneRelations((prev) => {
        const existingIndex = prev.findIndex((r) => r.id === relation.id);
        return existingIndex > -1
          ? prev.map((r, index) => (index === existingIndex ? relation : r))
          : [...prev, relation];
      });
      AppAlert.alert(t('success'), t('character_scene_saved_successfully'));
      return;
    }
    if (!characterSceneServiceRef.current || !selectedStory?.id || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await characterSceneServiceRef.current.saveCharacterScene(
        userId,
        relation,
      );
      setCharacterSceneRelations((prev) => {
        const existingIndex = prev.findIndex((r) => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        } else {
          return [...prev, savedRelation];
        }
      });
      entityEventEmitter.emit('character_scene_changed', selectedStory.id, currentSceneId);
      AppAlert.alert(t('success'), t('character_scene_saved_successfully'));
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_save_character_scene'));
      console.error('Failed to save character-scene relation:', error);
    }
  };

  const handleDeleteCharacterSceneRelation = async (relationId: string) => {
    if (!currentSceneId) {
      setPendingCharacterSceneRelations((prev) => prev.filter((r) => r.id !== relationId));
      AppAlert.alert(t('success'), t('character_scene_deleted_successfully'));
      return;
    }
    if (!characterSceneServiceRef.current || !selectedStory?.id || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await characterSceneServiceRef.current.deleteCharacterScene(
        userId,
        relationId,
      );
      if (success) {
        setCharacterSceneRelations((prev) => prev.filter((r) => r.id !== relationId));
        entityEventEmitter.emit('character_scene_changed', selectedStory.id, currentSceneId);
        AppAlert.alert(t('success'), t('character_scene_deleted_successfully'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_delete_character_scene'));
      }
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_delete_character_scene'));
      console.error('Failed to delete character-scene relation:', error);
    }
  };

  /**
   * Actually writes the relations accumulated while the scene did not exist yet - `sceneId` held
   * '' in place of the id (the form's placeholder, see `SceneCharacterManager`); it swaps in the real id
   * here.
   */
  const persistPendingCharacterSceneRelations = async (targetSceneId: string) => {
    if (!characterSceneServiceRef.current || !selectedStory?.id || !userId) return;
    for (const pending of pendingCharacterSceneRelations) {
      await characterSceneServiceRef.current.saveCharacterScene(userId, {
        ...pending,
        sceneId: targetSceneId,
      });
    }
    if (pendingCharacterSceneRelations.length > 0) {
      setPendingCharacterSceneRelations([]);
      entityEventEmitter.emit('character_scene_changed', selectedStory.id, targetSceneId);
    }
  };

  const handleSavePlotSceneRelation = async (relation: PlotScene) => {
    if (!currentSceneId) {
      setPendingPlotSceneRelations((current) => [
        ...current.filter((item) => item.id !== relation.id),
        relation,
      ]);
      return;
    }
    if (!plotSceneServiceRef.current || !userId) return;
    const saved = await plotSceneServiceRef.current.save(userId, relation);
    setPlotSceneRelations((current) => [...current.filter((item) => item.id !== saved.id), saved]);
  };

  const handleDeletePlotSceneRelation = async (relationId: string) => {
    if (!currentSceneId) {
      setPendingPlotSceneRelations((current) => current.filter((item) => item.id !== relationId));
      return;
    }
    if (!plotSceneServiceRef.current || !userId) return;
    await plotSceneServiceRef.current.delete(userId, relationId);
    setPlotSceneRelations((current) => current.filter((item) => item.id !== relationId));
  };

  const persistPendingPlotSceneRelations = async (targetSceneId: string) => {
    if (!plotSceneServiceRef.current || !userId) return;
    for (const relation of pendingPlotSceneRelations) {
      await plotSceneServiceRef.current.save(userId, { ...relation, sceneId: targetSceneId });
    }
    setPendingPlotSceneRelations([]);
  };

  const chapterOptions = useMemo(() => {
    return chapters.map((chapter) => ({ label: chapter.name, value: chapter.id }));
  }, [chapters]);

  const locationOptions = useMemo(() => {
    return locations.map((location) => ({ label: location.name, value: location.id }));
  }, [locations]);

  const itemOptions = useMemo(
    () =>
      items.filter((item) => !item.isDeleted).map((item) => ({ label: item.name, value: item.id })),
    [items],
  );

  const effectTypeOptions = useMemo(
    () => [
      { label: t('effect_type_item_grant'), value: 'itemGrant' },
      { label: t('effect_type_item_take'), value: 'itemTake' },
      { label: t('effect_type_trigger_set'), value: 'triggerSet' },
      { label: t('effect_type_trigger_unset'), value: 'triggerUnset' },
    ],
    [t],
  );

  const gapDurationTypeOptions = [
    { label: t('seconds'), value: 'seconds' },
    { label: t('minutes'), value: 'minutes' },
    { label: t('hours'), value: 'hours' },
    { label: t('days'), value: 'days' },
    { label: t('weeks'), value: 'weeks' },
    { label: t('months'), value: 'months' },
    { label: t('years'), value: 'years' },
    { label: t('millennia'), value: 'millennia' },
    { label: t('eons'), value: 'eons' },
  ];

  const styles = StyleSheet.create({
    ...commonFormStyleDefs(colors, scrollBottomPadding),
    noteSection: {
      marginTop: 20,
      marginBottom: -10,
    },
    tagSection: {
      marginTop: 20,
      marginBottom: 0,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
    effectsSection: {
      marginBottom: 30,
    },
    numberWidthInput: {
      width: '30%',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    timingHint: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      marginTop: -4,
      marginBottom: 10,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    cardRowLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
    fieldFlex: { flex: 1 },
    removeLink: { color: colors.error, fontWeight: '600' },
    addLink: { color: colors.primary, fontWeight: '600', marginTop: 4 },
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
      <Text style={[styles.title, { color: colors.text }]}>
        {isEditing ? t('edit_scene_title') : t('create_scene_title')}
      </Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
        {t('scene_form_description')}
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>{t('chapter')}</Text>
      <Select
        options={chapterOptions}
        value={chapterId}
        onValueChange={setChapterId}
        placeholder={t('select_chapter_optional')}
        multiple={false}
        allowDeselect
      />
      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
        {t('scene_chapter_optional_hint')}
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>{t('location')}</Text>
      {/*
        Optional since 1.6. An era, a war, a rumour heard in three cities is a scene with no single
        place, and requiring one was Keres deciding something about the story on the writer's
        behalf. `allowDeselect` is what lets them take it back off.
      */}
      <Select
        options={locationOptions}
        value={locationId}
        onValueChange={setLocationId}
        placeholder={t('select_location_optional')}
        multiple={false}
        allowDeselect
      />
      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
        {t('scene_location_optional_hint')}
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>{t('name')}</Text>
      <TextInput
        placeholder={t('name_placeholder')}
        value={name}
        onChangeText={setName}
        style={commonInputStyles.input}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('summary')}</Text>
      <TextInput
        placeholder={t('summary_placeholder')}
        value={summary || ''}
        onChangeText={setSummary}
        style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
        multiline
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

      {/* New Scene Fields */}
      <Text style={[styles.label, { color: colors.text }]}>{t('gap')}</Text>
      <View style={styles.row}>
        <TextInput
          placeholder={t('gap_placeholder')}
          value={gapInput}
          onChangeText={(text) => isTimingInput(text) && setGapInput(text)}
          keyboardType="numbers-and-punctuation"
          style={[commonInputStyles.input, styles.numberWidthInput]}
        />
        <View style={{ flex: 1 }}>
          <Select
            options={gapDurationTypeOptions}
            value={gapType}
            onValueChange={setGapType}
            placeholder={t('gap_type_placeholder')}
            multiple={false}
          />
        </View>
      </View>
      {parseTimingInput(gapInput) !== null && parseTimingInput(gapInput)! < 0 && (
        <Text style={styles.timingHint}>{t('negative_gap_timing_hint')}</Text>
      )}

      <Text style={[styles.label, { color: colors.text }]}>{t('duration')}</Text>
      <View style={styles.row}>
        <TextInput
          placeholder={t('duration_placeholder')}
          value={durationInput}
          onChangeText={(text) => isTimingInput(text) && setDurationInput(text)}
          keyboardType="numbers-and-punctuation"
          style={[commonInputStyles.input, styles.numberWidthInput]}
        />
        <View style={{ flex: 1 }}>
          <Select
            options={gapDurationTypeOptions}
            value={durationType}
            onValueChange={setDurationType}
            placeholder={t('duration_type_placeholder')}
            multiple={false}
          />
        </View>
      </View>
      {parseTimingInput(durationInput) !== null && parseTimingInput(durationInput)! < 0 && (
        <Text style={styles.timingHint}>{t('negative_duration_timing_hint')}</Text>
      )}

      <View style={styles.switchContainer}>
        <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5 }]}>
          {t('is_start_scene')}
        </Text>
        <ThemedSwitch
          value={isStart}
          onValueChange={setIsStart}
          style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
        />
      </View>

      <View style={styles.switchContainer}>
        <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5 }]}>
          {t('is_finish_scene')}
        </Text>
        <ThemedSwitch
          value={isFinish}
          onValueChange={setIsFinish}
          style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
        />
      </View>
      {/* End New Scene Fields */}

      <CustomAttributeFields
        storyId={selectedStory?.id || ''}
        fields={customFields}
        values={customValues}
        onChange={(fieldId, value) => setCustomValues((prev) => ({ ...prev, [fieldId]: value }))}
      />

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <MultiSelectPill
            options={availableTags.map((tag) => ({
              label: tag.name,
              value: tag.id,
              color: tag.color || colors.primaryContainer,
            }))}
            selectedValues={selectedTagIds}
            onSelectionChange={handleTagSelectionChange}
            placeholder={t('select_tags_for_scene')}
            label={t('scene_tags')}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <SceneCharacterManager
            characterRelations={
              currentSceneId ? characterSceneRelations : pendingCharacterSceneRelations
            }
            availableCharacters={characters.filter((char) => !char.isDeleted)}
            onSave={handleSaveCharacterSceneRelation}
            onDelete={handleDeleteCharacterSceneRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentSceneId={currentSceneId ?? ''}
          />
        </View>
      )}

      {selectedStory?.id && !isBranching && (
        <View style={styles.noteSection}>
          <ScenePlotManager
            relations={currentSceneId ? plotSceneRelations : pendingPlotSceneRelations}
            plots={plots}
            currentStoryId={selectedStory.id}
            currentSceneId={currentSceneId ?? ''}
            editable={true}
            onSave={handleSavePlotSceneRelation}
            onDelete={handleDeletePlotSceneRelation}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <NoteManager
            noteRelations={sceneNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentSceneId ?? ''}
            currentEntityType="Scene"
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="Scene"
            entityId={currentSceneId ?? ''}
            editable={true}
          />
        </View>
      )}

      {currentSceneId && selectedStory?.id && isBranching && (
        <View style={[styles.tagSection, styles.effectsSection]}>
          <Text style={styles.sectionTitle}>{t('effects_title')}</Text>

          {sceneEffects.map((effect) => (
            <View key={effect.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.fieldFlex}>
                  <Text style={styles.cardRowLabel}>{t('effect_type')}</Text>
                  <Select
                    options={effectTypeOptions}
                    value={effect.effectType}
                    onValueChange={(value) =>
                      value && handleChangeEffectType(effect.id, value as Effect['effectType'])
                    }
                    multiple={false}
                  />
                </View>
              </View>

              {(effect.effectType === 'itemGrant' || effect.effectType === 'itemTake') && (
                <View style={styles.cardRow}>
                  <View style={styles.fieldFlex}>
                    <Text style={styles.cardRowLabel}>{t('item')}</Text>
                    <Select
                      options={itemOptions}
                      value={effect.itemId}
                      onValueChange={(value) => handleUpdateEffect(effect.id, { itemId: value })}
                      placeholder={t('select_item')}
                      multiple={false}
                      allowDeselect={true}
                    />
                  </View>
                </View>
              )}

              {(effect.effectType === 'triggerSet' || effect.effectType === 'triggerUnset') && (
                <View style={styles.cardRow}>
                  <View style={styles.fieldFlex}>
                    <Text style={styles.cardRowLabel}>{t('check_trigger_name')}</Text>
                    <TextInput
                      placeholder={t('check_trigger_name_placeholder')}
                      value={effect.triggerName || ''}
                      onChangeText={(value) =>
                        handleUpdateEffect(effect.id, { triggerName: value || null })
                      }
                      style={commonInputStyles.input}
                    />
                  </View>
                </View>
              )}

              <TouchableOpacity onPress={() => handleDeleteEffect(effect.id)}>
                <Text style={styles.removeLink}>{t('remove_effect')}</Text>
              </TouchableOpacity>
            </View>
          ))}

          {sceneEffects.length === 0 && (
            <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>{t('no_effects')}</Text>
          )}

          <TouchableOpacity onPress={handleAddEffect}>
            <Text style={styles.addLink}>{t('add_effect')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Button onPress={handleSave} style={styles.saveButton}>
        {t('save_scene')}
      </Button>

      {isEditing && (
        <Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>
          {t('delete_scene_title')}
        </Button>
      )}
    </KeyboardAwareScreen>
  );
};

export default SceneFormScreen;
