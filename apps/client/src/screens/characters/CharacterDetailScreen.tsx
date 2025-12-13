import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import { CharacterSelect } from '../../db/schemas/characters';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { createCharacterService } from '../../services/CharacterService';
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

  const drizzleDb = useDrizzle();
  const characterServiceRef = useRef<ReturnType<typeof createCharacterService> | null>(null);

  // Initialize characterService only once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb && !characterServiceRef.current) {
      characterServiceRef.current = createCharacterService(drizzleDb);
    }
  }, [drizzleDb]);

  const [character, setCharacter] = useState<CharacterSelect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState('Loading...');

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
    }
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
        setHeaderTitle(fetchedCharacter.name || 'Character Details');
      } else if (fetchedCharacter && fetchedCharacter.isDeleted) {
        // If character is deleted, go back
        navigation.goBack();
      }
      else {
        setError('Character not found.');
        setHeaderTitle('Character Not Found');
      }
    } catch (err) {
      console.error('Failed to fetch character details:', err);
      setError('Failed to load character details.');
      setHeaderTitle('Error Loading Character');
    } finally {
      setLoading(false);
    }
  }, [characterId, setCharacter, setLoading, setError, setHeaderTitle, navigation, characterServiceRef.current]);

  const handleCharacterChange = useCallback(async (changedStoryId: string, changedCharacterId: string) => {
    if (changedCharacterId === characterId) {
      // Re-fetch the character to get the latest status, including isDeleted
      if (characterServiceRef.current) {
        const updatedCharacter = await characterServiceRef.current.getById(characterId);
        if (!updatedCharacter || updatedCharacter.isDeleted) {
          navigation.goBack(); // Character was deleted or no longer found
        } else {
          setCharacter(updatedCharacter); // Update state with latest character data
          setHeaderTitle(updatedCharacter.name || 'Character Details');
        }
      }
    }
  }, [characterId, navigation, setCharacter, setHeaderTitle, characterServiceRef.current]);

  useEffect(() => {
    // Only subscribe and fetch if characterServiceRef.current is initialized
    if (characterServiceRef.current) {
      fetchCharacter();

      entityEventEmitter.on('character_changed', handleCharacterChange);

      return () => {
        entityEventEmitter.off('character_changed', handleCharacterChange);
      };
    }
  }, [characterId, fetchCharacter, handleCharacterChange, characterServiceRef.current]);

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
        headerRight: renderHeaderRight, // Pass the memoized component
      });
    }, [navigation, headerTitle, renderHeaderRight])
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>Loading character details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{error}</Text>
        <View style={styles.buttonContainer}>
          <Button title="Go Back" onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!character) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>Character data is missing.</Text>
        <View style={styles.buttonContainer}>
          <Button title="Go Back" onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>{character.name}</Text>
      {character.title && <Text style={styles.subTitle}>{character.title}</Text>}
      
      <Text style={styles.detailText}>Gender: {character.gender || 'N/A'}</Text>
      <Text style={styles.detailText}>Race: {character.race || 'N/A'}</Text>
      {character.subrace && <Text style={styles.detailText}>Subrace: {character.subrace}</Text>}
      <Text style={styles.detailText}>Description: {character.description || 'N/A'}</Text>
      <Text style={styles.detailText}>Personality: {character.personality || 'N/A'}</Text>
      <Text style={styles.detailText}>Motivation: {character.motivation || 'N/A'}</Text>
      <Text style={styles.detailText}>Qualities: {character.qualities || 'N/A'}</Text>
      <Text style={styles.detailText}>Weaknesses: {character.weaknesses || 'N/A'}</Text>
      <Text style={styles.detailText}>Biography: {character.biography || 'N/A'}</Text>
      <Text style={styles.detailText}>Planned Timeline: {character.plannedTimeline || 'N/A'}</Text>
      <Text style={styles.detailText}>Favorite: {character.isFavorite ? 'Yes' : 'No'}</Text>
      <Text style={styles.detailText}>Extra Notes: {character.extraNotes || 'N/A'}</Text>
      
      <View style={styles.buttonContainer}>
        <Button title="Go Back" onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </View>
  );
};

export default CharacterDetailScreen;
