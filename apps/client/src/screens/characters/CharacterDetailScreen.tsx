import { Ionicons } from '@expo/vector-icons';
import { CharacterRelation } from '@keres/shared/entities/CharacterRelation'; // Import CharacterRelation
import { Note, NoteRelation } from '@keres/shared/entities/Note';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'; // Added Alert
import CharacterRelationManager from '../../components/CharacterRelationManager/CharacterRelationManager'; // Import CharacterRelationManager
import NoteManager from '../../components/NoteManager'; // Import NoteManager
import TagChipList from '../../components/common/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema';
import { CharacterSelect } from '../../db/schemas/characters';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { CharacterRelationServiceInterface, createCharacterRelationService } from '../../services/CharacterRelationService'; // Import CharacterRelationService
import { createCharacterService } from '../../services/CharacterService';
import { createNoteRelationService, NoteRelationServiceInterface } from '../../services/NoteRelationService'; // Import NoteRelationService
import { createNoteService, NoteService } from '../../services/NoteService'; // Import NoteService
import { createTagRelationService } from '../../services/TagRelationService';
import { createTagService } from '../../services/TagService';
import { useUserSettingsStore } from '../../state/userSettingsStore'; // Import useUserSettingsStore
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { type CharactersScreenNavigationProp } from './CharacterListScreen';

// Define the parameter list for this screen
export type CharacterDetailScreenParamList = {
  CharacterDetail: { characterId: string };
};

type CharacterDetailScreenRouteProp = RouteProp<CharacterDetailScreenParamList, 'CharacterDetail'>;

const CharacterDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<CharactersScreenNavigationProp>();
  const route = useRoute<CharacterDetailScreenRouteProp>();
  const { characterId } = route.params;
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore(); // Get userId from store

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

  const [character, setCharacter] = useState<CharacterSelect | null>(null);
  const [characterTags, setCharacterTags] = useState<TagSelect[]>([]);
  const [characterRelations, setCharacterRelations] = useState<CharacterRelation[]>([]); // State for relations
  const [allCharacters, setAllCharacters] = useState<CharacterSelect[]>([]); // State for all characters in story
  const [allNotes, setAllNotes] = useState<Note[]>([]); // State for all notes in story
  const [characterNoteRelations, setCharacterNoteRelations] = useState<NoteRelation[]>([]); // State for note relations
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  // Move styles declaration to the top
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    mainTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 5,
    },
    subTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 15,
    },
    detailText: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 5,
    },
    errorText: {
      color: colors.error,
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

  const fetchCharacter = useCallback(async () => {
    if (!characterServiceRef.current) {
      console.warn('Character service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedCharacter = await characterServiceRef.current.getById(characterId);
      if (fetchedCharacter && !fetchedCharacter.isDeleted) {
        setCharacter(fetchedCharacter);
        setHeaderTitle(fetchedCharacter.name || t('character_details_title'));
      } else if (fetchedCharacter && fetchedCharacter.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('character_not_found'));
        setHeaderTitle(t('character_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch character details:', err);
      setError(t('failed_to_load_character'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [characterId, setCharacter, setLoading, setError, setHeaderTitle, navigation, characterServiceRef.current, t]);

  const fetchTagsForCharacter = useCallback(async () => {
    if (!tagRelationServiceRef.current || !character?.storyId || !characterId) {
      setCharacterTags([]);
      return;
    }
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(character.storyId, characterId, 'Character');
      setCharacterTags(fetchedTags);
    } catch (err) {
      console.error('Failed to fetch tags for character:', err);
      // Optionally set an error state for tags specifically
    }
  }, [character?.storyId, characterId, tagRelationServiceRef.current]);

  const fetchRelationsForCharacter = useCallback(async () => {
    if (!characterRelationServiceRef.current || !character?.storyId || !characterId) {
      setCharacterRelations([]);
      return;
    }
    try {
      const fetchedRelations = await characterRelationServiceRef.current.getRelationsForCharacter(character.storyId, characterId);
      setCharacterRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch character relations:', err);
    }
  }, [character?.storyId, characterId, characterRelationServiceRef.current]);

  const fetchAllCharactersInStory = useCallback(async () => {
    if (!characterServiceRef.current || !character?.storyId) {
      setAllCharacters([]);
      return;
    }
    try {
      const fetchedCharacters = await characterServiceRef.current.getAllByStoryId(character.storyId);
      setAllCharacters(fetchedCharacters.filter(c => !c.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all characters:', err);
    }
  }, [character?.storyId, characterServiceRef.current]);

  const fetchNotesForStory = useCallback(async () => {
    if (!noteServiceRef.current || !character?.storyId) {
      setAllNotes([]);
      return;
    }
    try {
      const fetchedNotes = await noteServiceRef.current.getNotesByStoryId(character.storyId);
      setAllNotes(fetchedNotes);
    } catch (err) {
      console.error('Failed to fetch notes for story:', err);
    }
  }, [character?.storyId, noteServiceRef.current]);

  const fetchNoteRelationsForCharacter = useCallback(async () => {
    if (!noteRelationServiceRef.current || !character?.storyId || !characterId) {
      setCharacterNoteRelations([]);
      return;
    }
    try {
      const fetchedNoteRelations = await noteRelationServiceRef.current.getRelationsForEntity(character.storyId, characterId, 'Character');
      setCharacterNoteRelations(fetchedNoteRelations);
    } catch (err) {
      console.error('Failed to fetch note relations for character:', err);
    }
  }, [character?.storyId, characterId, noteRelationServiceRef.current]);

  const handleCharacterChange = useCallback(async (changedStoryId: string, changedCharacterId: string) => {
    if (changedCharacterId === characterId) {
      if (characterServiceRef.current) {
        const updatedCharacter = await characterServiceRef.current.getById(characterId);
        if (!updatedCharacter || updatedCharacter.isDeleted) {
          navigation.goBack();
        } else {
          setCharacter(updatedCharacter);
          setHeaderTitle(updatedCharacter.name || t('character_details_title'));
        }
      }
    }
  }, [characterId, navigation, setCharacter, setHeaderTitle, characterServiceRef.current, t]);

  const handleTagRelationChange = useCallback((changedStoryId: string, changedEntityId: string) => {
    if (changedEntityId === characterId) {
      fetchTagsForCharacter();
    }
  }, [characterId, fetchTagsForCharacter]);

  const handleCharacterRelationChange = useCallback((changedStoryId: string, changedCharacterId: string) => {
    if (changedCharacterId === characterId) {
      fetchRelationsForCharacter();
    }
  }, [characterId, fetchRelationsForCharacter]);

  const handleNoteChange = useCallback((changedStoryId: string, changedNoteId: string) => {
    if (character?.storyId === changedStoryId) {
      fetchNotesForStory();
    }
  }, [character?.storyId, fetchNotesForStory]);

  const handleNoteRelationChange = useCallback((changedStoryId: string, changedNoteRelationId: string) => {
    if (character?.storyId === changedStoryId) {
      fetchNoteRelationsForCharacter();
    }
  }, [character?.storyId, fetchNoteRelationsForCharacter]);


  useEffect(() => {
    if (characterServiceRef.current) {
      fetchCharacter();
      entityEventEmitter.on('character_changed', handleCharacterChange);
      entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);
      entityEventEmitter.on('character_relation_changed', handleCharacterRelationChange); // Listen for character relation changes
      entityEventEmitter.on('note_changed', handleNoteChange); // Listen for note changes
      entityEventEmitter.on('note_relation_changed', handleNoteRelationChange); // Listen for note relation changes

      return () => {
        entityEventEmitter.off('character_changed', handleCharacterChange);
        entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
        entityEventEmitter.off('character_relation_changed', handleCharacterRelationChange);
        entityEventEmitter.off('note_changed', handleNoteChange);
        entityEventEmitter.off('note_relation_changed', handleNoteRelationChange);
      };
    }
  }, [characterId, fetchCharacter, handleCharacterChange, handleTagRelationChange, handleCharacterRelationChange, handleNoteChange, handleNoteRelationChange, characterServiceRef.current]);

  useEffect(() => {
    // Fetch tags, relations, all characters, all notes, and note relations when character is loaded or changes
    if (character) {
      fetchTagsForCharacter();
      fetchRelationsForCharacter();
      fetchAllCharactersInStory(); // Fetch all characters here
      fetchNotesForStory(); // Fetch all notes
      fetchNoteRelationsForCharacter(); // Fetch note relations
    }
  }, [character, fetchTagsForCharacter, fetchRelationsForCharacter, fetchAllCharactersInStory, fetchNotesForStory, fetchNoteRelationsForCharacter]);

  const handleSaveRelation = async (relation: CharacterRelation) => {
    if (!characterRelationServiceRef.current || !character?.storyId || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await characterRelationServiceRef.current.saveCharacterRelation(userId, relation);
      // Update local state and emit event
      setCharacterRelations(prev => {
        const existingIndex = prev.findIndex(r => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        } else {
          return [...prev, savedRelation];
        }
      });
      entityEventEmitter.emit('character_relation_changed', character?.storyId, characterId);
      Alert.alert(t('success'), t('relation_saved_successfully'));
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_save_relation'));
      console.error('Failed to save character relation:', error);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (!characterRelationServiceRef.current || !character?.storyId || !userId) { // Added !userId check
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await characterRelationServiceRef.current.deleteCharacterRelation(userId, relationId); // Pass userId
      if (success) {
        setCharacterRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('character_relation_changed', character?.storyId, characterId);
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
    if (!noteRelationServiceRef.current || !character?.storyId || !userId) {
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
      entityEventEmitter.emit('note_relation_changed', character?.storyId, characterId);
      Alert.alert(t('success'), t('note_relation_saved_successfully'));
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_save_note_relation'));
      console.error('Failed to save note relation:', error);
    }
  };

  const handleDeleteNoteRelation = async (relationId: string) => {
    if (!noteRelationServiceRef.current || !character?.storyId || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await noteRelationServiceRef.current.deleteNoteRelation(userId, relationId);
      if (success) {
        setCharacterNoteRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('note_relation_changed', character?.storyId, characterId);
        Alert.alert(t('success'), t('note_relation_deleted_successfully'));
      } else {
        Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      console.error('Failed to delete note relation:', error);
    }
  };


  const renderHeaderRight = useCallback(() => (
    <TouchableOpacity
      onPress={() => navigation.navigate('CharacterForm', { characterId: characterId })}
      style={{ marginRight: 15 }}
    >
      <Ionicons name="pencil-outline" size={24} color={colors.text} />
    </TouchableOpacity>
  ), [navigation, characterId, colors.text]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: headerTitle,
        headerRight: renderHeaderRight,
      });
    }, [navigation, headerTitle, renderHeaderRight])
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>{t('loading_character_details')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{error}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!character) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{t('character_data_missing')}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.mainTitle}>{character.name}</Text>
      {character.title && <Text style={styles.subTitle}>{character.title}</Text>}
      
      <Text style={styles.detailText}>{t('gender')}: {character.gender || t('common_na')}</Text>
      <Text style={styles.detailText}>{t('race')}: {character.race || t('common_na')}</Text>
      {character.subrace && <Text style={styles.detailText}>{t('subrace')}: {character.subrace}</Text>}
      <Text style={styles.detailText}>{t('description')}: {character.description || t('common_na')}</Text>
      <Text style={styles.detailText}>{t('personality')}: {character.personality || t('common_na')}</Text>
      <Text style={styles.detailText}>{t('motivation')}: {character.motivation || t('common_na')}</Text>
      <Text style={styles.detailText}>{t('qualities')}: {character.qualities || t('common_na')}</Text>
      <Text style={styles.detailText}>{t('weaknesses')}: {character.weaknesses || t('common_na')}</Text>
      <Text style={styles.detailText}>{t('biography')}: {character.biography || t('common_na')}</Text>
      <Text style={styles.detailText}>{t('planned_timeline')}: {character.plannedTimeline || t('common_na')}</Text>
      <Text style={styles.detailText}>{t('is_favorite')}: {character.isFavorite ? t('common_yes') : t('common_no')}</Text>
      <Text style={styles.detailText}>{t('extra_notes')}: {character.extraNotes || t('common_na')}</Text>

      <Text style={styles.sectionTitle}>{t('character_relations_title')}</Text>
      <CharacterRelationManager
        characterRelations={characterRelations}
        characters={allCharacters}
        onSave={handleSaveRelation}
        onDelete={handleDeleteRelation}
        editable={false}
        currentStoryId={character.storyId}
        currentCharacterId={characterId}
      />

      <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
      <NoteManager
        noteRelations={characterNoteRelations}
        availableNotes={allNotes}
        onSave={handleSaveNoteRelation}
        onDelete={handleDeleteNoteRelation}
        editable={false}
        currentStoryId={character.storyId}
        currentEntityId={characterId}
        currentEntityType="Character"
      />

      <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
      <TagChipList tags={characterTags} />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default CharacterDetailScreen;