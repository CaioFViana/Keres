import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema';
import { CharacterSelect } from '../../db/schemas/characters';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { createCharacterService } from '../../services/CharacterService';
import { createTagRelationService } from '../../services/TagRelationService';
import { createTagService } from '../../services/TagService';
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

  const drizzleDb = useDrizzle();
  const characterServiceRef = useRef<ReturnType<typeof createCharacterService> | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);

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
    }
  }, [drizzleDb]);

  const [character, setCharacter] = useState<CharacterSelect | null>(null);
  const [characterTags, setCharacterTags] = useState<TagSelect[]>([]);
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

  useEffect(() => {
    if (characterServiceRef.current) {
      fetchCharacter();
      entityEventEmitter.on('character_changed', handleCharacterChange);
      entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);

      return () => {
        entityEventEmitter.off('character_changed', handleCharacterChange);
        entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
      };
    }
  }, [characterId, fetchCharacter, handleCharacterChange, handleTagRelationChange, characterServiceRef.current]);

  useEffect(() => {
    // Fetch tags when character is loaded or changes
    if (character) {
      fetchTagsForCharacter();
    }
  }, [character, fetchTagsForCharacter]);


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
    <View style={styles.container}>
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

      <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
      <TagChipList tags={characterTags} />
      
      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </View>
  );
};

export default CharacterDetailScreen;