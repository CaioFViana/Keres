import TextInput from '@/src/components/common/TextInput/TextInput';
import { Character } from '@keres/shared/entities/Character';
import { Note, NoteRelation, NoteRelationEntities } from '@keres/shared/entities/Note'; // Import Note and NoteRelation
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteProp, useFocusEffect, useNavigation, useRoute, StackActions } from '@react-navigation/native'; // Import StackActions
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import MultiSelectPill from '../../components/common/MultiSelectPill/MultiSelectPill';
import SuggestionTextInput from '../../components/common/SuggestionTextInput/SuggestionTextInput';
import CharacterRelationManager from '../../components/CharacterRelationManager/CharacterRelationManager'; // Import CharacterRelationManager
import NoteManager from '../../components/NoteManager/NoteManager'; // Import NoteManager
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema';
import { CharacterSelect } from '../../db/schemas/characters'; // Import CharacterSelect for character objects
import { CharacterRelation } from '@keres/shared/entities/CharacterRelation'; // Import CharacterRelation
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { CharacterStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { createCharacterService } from '../../services/CharacterService';
import { createTagRelationService } from '../../services/TagRelationService';
import { createTagService } from '../../services/TagService';
import { createCharacterRelationService, CharacterRelationServiceInterface } from '../../services/CharacterRelationService'; // Import CharacterRelationService
import { createNoteService, NoteService } from '../../services/NoteService'; // Import NoteService
import { createNoteRelationService, NoteRelationServiceInterface } from '../../services/NoteRelationService'; // Import NoteRelationService
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter'; // Import EventEmitter
import { NativeStackNavigationProp } from '@react-navigation/native-stack';


type CharacterFormScreenRouteProp = RouteProp<CharacterStackParamList, 'CharacterForm'>;
type CharacterFormScreenNavigationProp = NativeStackNavigationProp<CharacterStackParamList, 'CharacterForm'>; // Corrected type alias

const CharacterFormScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<CharacterFormScreenNavigationProp>(); // Use the specific navigation type
  const drawerNavigation = useNavigation<DrawerNavigationProp<MainSystemDrawerParamList>>();
  const route = useRoute<CharacterFormScreenRouteProp>();
  const { characterId: initialCharacterId } = route.params || {}; // Renamed to initialCharacterId
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const characterServiceRef = useRef<ReturnType<typeof createCharacterService> | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);
  const characterRelationServiceRef = useRef<CharacterRelationServiceInterface | null>(null); // Ref for CharacterRelationService
  const noteServiceRef = useRef<NoteService | null>(null); // Ref for NoteService
  const noteRelationServiceRef = useRef<NoteRelationServiceInterface | null>(null); // Ref for NoteRelationService


  // Initialize services once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb) {
      if (!characterServiceRef.current) {
        characterServiceRef.current = createCharacterService(drizzleDb);
      }
      if (!tagServiceRef.current) {
        tagServiceRef.current = createTagService(drizzleDb);
      }
      if (!tagRelationServiceRef.current) {
        tagRelationServiceRef.current = createTagRelationService(drizzleDb);
      }
      if (!characterRelationServiceRef.current) {
        characterRelationServiceRef.current = createCharacterRelationService(drizzleDb);
      }
      if (!noteServiceRef.current) {
        noteServiceRef.current = createNoteService(drizzleDb);
      }
      if (!noteRelationServiceRef.current) {
        noteRelationServiceRef.current = createNoteRelationService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  const [currentCharacterId, setCurrentCharacterId] = useState<string | undefined>(initialCharacterId); // State to manage characterId
  const [name, setName] = useState('');
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [race, setRace] = useState<string | null>(null);
  const [subrace, setSubrace] = useState<string | null>(null);
  const [personality, setPersonality] = useState<string | null>(null);
  const [motivation, setMotivation] = useState<string | null>(null);
  const [qualities, setQualities] = useState<string | null>(null);
  const [weaknesses, setWeaknesses] = useState<string | null>(null);
  const [biography, setBiography] = useState<string | null>(null);
  const [plannedTimeline, setPlannedTimeline] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  const [availableTags, setAvailableTags] = useState<TagSelect[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [allCharacters, setAllCharacters] = useState<CharacterSelect[]>([]); // To pass to CharacterRelationManager
  const [characterRelations, setCharacterRelations] = useState<CharacterRelation[]>([]); // State for relations
  const [allNotes, setAllNotes] = useState<Note[]>([]); // State for all notes in story
  const [characterNoteRelations, setCharacterNoteRelations] = useState<NoteRelation[]>([]); // State for note relations


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!currentCharacterId;

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_character_title') : t('create_character_title'),
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

  const fetchCharacterTags = useCallback(async () => {
    if (!tagRelationServiceRef.current || !selectedStory?.id || !currentCharacterId) {
      setSelectedTagIds([]);
      return;
    }
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(selectedStory.id, currentCharacterId, 'Character');
      setSelectedTagIds(fetchedTags.map(tag => tag.id));
    } catch (err) {
      console.error('Failed to fetch character tags:', err);
    }
  }, [selectedStory?.id, currentCharacterId, tagRelationServiceRef.current]);

  const fetchAllCharactersInStory = useCallback(async () => {
    if (!characterServiceRef.current || !selectedStory?.id) {
      setAllCharacters([]);
      return;
    }
    try {
      const fetchedCharacters = await characterServiceRef.current.getAllByStoryId(selectedStory.id);
      setAllCharacters(fetchedCharacters.filter(c => !c.isDeleted)); // Filter out deleted characters
    } catch (err) {
      console.error('Failed to fetch all characters:', err);
    }
  }, [selectedStory?.id, characterServiceRef.current]);

  const fetchRelationsForCharacter = useCallback(async () => {
    if (!characterRelationServiceRef.current || !selectedStory?.id || !currentCharacterId) {
      setCharacterRelations([]);
      return;
    }
    try {
      const fetchedRelations = await characterRelationServiceRef.current.getRelationsForCharacter(selectedStory.id, currentCharacterId);
      setCharacterRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch character relations:', err);
    }
  }, [selectedStory?.id, currentCharacterId, characterRelationServiceRef.current]);

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

  const fetchNoteRelationsForCharacter = useCallback(async () => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !currentCharacterId) {
      setCharacterNoteRelations([]);
      return;
    }
    try {
      const fetchedNoteRelations = await noteRelationServiceRef.current.getRelationsForEntity(selectedStory.id, currentCharacterId, 'Character');
      setCharacterNoteRelations(fetchedNoteRelations);
    } catch (err) {
      console.error('Failed to fetch note relations for character:', err);
    }
  }, [selectedStory?.id, currentCharacterId, noteRelationServiceRef.current]);

  useEffect(() => {
    const loadCharacterAndData = async () => {
      if (!characterServiceRef.current || !selectedStory?.id) {
        console.warn('Character service or selected story not available.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (isEditing) {
          const fetchedCharacter = await characterServiceRef.current.getById(currentCharacterId!);
          if (fetchedCharacter) {
            setName(fetchedCharacter.name);
            setTitle(fetchedCharacter.title);
            setDescription(fetchedCharacter.description);
            setGender(fetchedCharacter.gender);
            setRace(fetchedCharacter.race);
            setSubrace(fetchedCharacter.subrace);
            setPersonality(fetchedCharacter.personality);
            setMotivation(fetchedCharacter.motivation);
            setQualities(fetchedCharacter.qualities);
            setWeaknesses(fetchedCharacter.weaknesses);
            setBiography(fetchedCharacter.biography);
            setPlannedTimeline(fetchedCharacter.plannedTimeline);
            setIsFavorite(fetchedCharacter.isFavorite);
            setExtraNotes(fetchedCharacter.extraNotes);
          } else {
            setError(t('character_not_found'));
          }
        }
      } catch (err) {
        console.error('Failed to load character or related data:', err);
        setError(t('failed_to_load_character'));
      } finally {
        setLoading(false);
        fetchAvailableTags();
        fetchCharacterTags();
        fetchAllCharactersInStory();
        fetchRelationsForCharacter();
        fetchNotesForStory();
        fetchNoteRelationsForCharacter();
      }
    };
    loadCharacterAndData();
  }, [currentCharacterId, isEditing, selectedStory?.id, characterServiceRef.current, t,
    fetchAvailableTags, fetchCharacterTags, fetchAllCharactersInStory,
    fetchRelationsForCharacter, fetchNotesForStory, fetchNoteRelationsForCharacter
  ]);
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
      const characterData: Omit<Character, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'> = {
        name: name.trim(),
        title: title ? title.trim() : null,
        description,
        gender,
        race,
        subrace,
        personality,
        motivation,
        qualities,
        weaknesses,
        biography,
        plannedTimeline,
        isFavorite,
        extraNotes,
      };

      let savedCharacter: Character;

      if (isEditing) {
        savedCharacter = await characterServiceRef.current!.updateCharacter(userId, currentCharacterId!, characterData);
        Alert.alert(t('success'), t('character_updated_successfully'));
      } else {
        savedCharacter = await characterServiceRef.current!.createCharacter(userId, { ...characterData, storyId: selectedStory.id });
        Alert.alert(t('success'), t('character_created_successfully'));
        setCurrentCharacterId(savedCharacter.id); // Set the ID for the newly created character
      }

      // Update tag relations
      if (savedCharacter.id && tagRelationServiceRef.current && selectedStory?.id) {
        await tagRelationServiceRef.current.updateTagsForEntity(userId, selectedStory.id, savedCharacter.id, 'Character', selectedTagIds);
      }
      
      entityEventEmitter.emit('character_changed', selectedStory.id, savedCharacter.id); // Emit change event

      // After saving character, if it's a new character, relations can now be added
      // Or if it was an edit, relations data might need a refresh.
      if (!isEditing && savedCharacter.id) {
          // If it was a new character, relations section will become editable now
          // A full reload or navigate might be better here to ensure all states are correct
          navigation.dispatch(StackActions.replace('CharacterForm', { characterId: savedCharacter.id })); // Fixed navigation.replace
      } else {
          navigation.goBack();
      }

    } catch (err) {
      console.error('Failed to save character:', err);
      setError(t('failed_to_save_character'));
      Alert.alert(t('error'), t('failed_to_save_character'));
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
      t('delete_character_title'),
      t('delete_character_message'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('delete'),
          onPress: async () => {
            if (currentCharacterId && characterServiceRef.current) {
              try {
                setLoading(true);
                await characterServiceRef.current.deleteCharacter(userId, currentCharacterId);
                entityEventEmitter.emit('character_changed', selectedStory?.id, currentCharacterId); // Emit change event
                Alert.alert(t('success'), t('character_deleted_successfully'));
                navigation.goBack();
              } catch (err) {
                console.error('Failed to delete character:', err);
                setError(t('failed_to_delete_character'));
                Alert.alert(t('error'), t('failed_to_delete_character'));
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

  const handleSaveRelation = async (relation: CharacterRelation) => {
    if (!characterRelationServiceRef.current || !selectedStory?.id || !currentCharacterId || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await characterRelationServiceRef.current.saveCharacterRelation(userId, relation);
      setCharacterRelations(prev => {
        const existingIndex = prev.findIndex(r => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        } else {
          return [...prev, savedRelation];
        }
      });
      entityEventEmitter.emit('character_relation_changed', selectedStory.id, currentCharacterId);
      Alert.alert(t('success'), t('relation_saved_successfully'));
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_save_relation'));
      console.error('Failed to save character relation:', error);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (!characterRelationServiceRef.current || !selectedStory?.id || !currentCharacterId || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await characterRelationServiceRef.current.deleteCharacterRelation(userId, relationId);
      if (success) {
        setCharacterRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('character_relation_changed', selectedStory.id, currentCharacterId);
        Alert.alert(t('success'), t('relation_deleted_successfully'));
      } else {
        Alert.alert(t('error'), t('failed_to_delete_relation'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_delete_relation'));
      console.error('Failed to delete character relation:', error);
    }
  };

  const handleSaveNoteRelation = async (relation: NoteRelation) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !currentCharacterId || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await noteRelationServiceRef.current.saveNoteRelation(userId, relation);
      setCharacterNoteRelations(prev => {
        const existingIndex = prev.findIndex(r => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        } else {
          return [...prev, savedRelation];
        }
      });
      entityEventEmitter.emit('note_relation_changed', selectedStory.id, currentCharacterId);
      Alert.alert(t('success'), t('note_relation_saved_successfully'));
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_save_note_relation'));
      console.error('Failed to save note relation:', error);
    }
  };

  const handleDeleteNoteRelation = async (relationId: string) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !currentCharacterId || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await noteRelationServiceRef.current.deleteNoteRelation(userId, relationId);
      if (success) {
        setCharacterNoteRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('note_relation_changed', selectedStory.id, currentCharacterId);
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
      paddingBottom: 350,
      flexGrow: 1,
    },    title: {
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
          <Text style={[styles.title, { color: colors.text }]}>{isEditing ? t('edit_character_title') : t('create_character_title')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
            {t('character_form_description')}
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

          <Text style={[styles.label, { color: colors.text }]}>{t('gender')}</Text>
          <SuggestionTextInput
            placeholder={t('gender_placeholder')}
            value={gender || ""}
            onChangeText={setGender}
            type="character_gender"
            style={commonInputStyles.input}
            storyId={selectedStory?.id || ''}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('race')}</Text>
          <SuggestionTextInput
            placeholder={t('race_placeholder')}
            value={race || ""}
            onChangeText={setRace}
            type="character_race"
            style={commonInputStyles.input}
            storyId={selectedStory?.id || ''}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('subrace')}</Text>
          <SuggestionTextInput
            placeholder={t('subrace_placeholder')}
            value={subrace || ""}
            onChangeText={setSubrace}
            type="character_subrace"
            style={commonInputStyles.input}
            storyId={selectedStory?.id || ''}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('personality')}</Text>
          <TextInput
            placeholder={t('personality_placeholder')}
            value={personality || ""}
            onChangeText={setPersonality}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('motivation')}</Text>
          <TextInput
            placeholder={t('motivation_placeholder')}
            value={motivation || ""}
            onChangeText={setMotivation}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('qualities')}</Text>
          <TextInput
            placeholder={t('qualities_placeholder')}
            value={qualities || ""}
            onChangeText={setQualities}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('weaknesses')}</Text>
          <TextInput
            placeholder={t('weaknesses_placeholder')}
            value={weaknesses || ""}
            onChangeText={setWeaknesses}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('biography')}</Text>
          <TextInput
            placeholder={t('biography_placeholder')}
            value={biography || ""}
            onChangeText={setBiography}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('planned_timeline')}</Text>
          <TextInput
            placeholder={t('planned_timeline_placeholder')}
            value={plannedTimeline || ""}
            onChangeText={setPlannedTimeline}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
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
              placeholder={t('select_tags_for_character')}
              label={t('character_tags')}
            />
          </View>

          {currentCharacterId && selectedStory?.id && (
            <View style={styles.tagSection}>
              <Text style={styles.sectionTitle}>{t('character_relations_title')}</Text>
              <CharacterRelationManager
                characterRelations={characterRelations}
                characters={allCharacters}
                onSave={handleSaveRelation}
                onDelete={handleDeleteRelation}
                editable={true} // Editable in form screen
                currentStoryId={selectedStory.id}
                currentCharacterId={currentCharacterId}
              />
            </View>
          )}

          {currentCharacterId && selectedStory?.id && (
            <View style={styles.tagSection}>
              <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
              <NoteManager
                noteRelations={characterNoteRelations}
                availableNotes={allNotes}
                onSave={handleSaveNoteRelation}
                onDelete={handleDeleteNoteRelation}
                editable={true}
                currentStoryId={selectedStory.id}
                currentEntityId={currentCharacterId}
                currentEntityType="Character"
              />
            </View>
          )}

          <Button onPress={handleSave} style={styles.saveButton}>
            {t('save_character')}
          </Button>

          {isEditing && (
            <Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>
              {t('delete_character_title')}
            </Button>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>
      </TouchableWithoutFeedback>    
    </KeyboardAvoidingView>
  );
};

export default CharacterFormScreen;