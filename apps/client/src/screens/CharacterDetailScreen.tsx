import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../db';
import { CharacterSelect } from '../db/schemas/characters'; // Correct import for CharacterSelect
import { useBackButtonHandler } from '../hooks/useBackButtonHandler';
import { createCharacterService } from '../services/CharacterService';
import { useTheme } from '../theme';

// Define the parameter list for this screen
export type CharacterDetailScreenParamList = {
  CharacterDetail: { characterId: string };
};

type CharacterDetailScreenRouteProp = RouteProp<CharacterDetailScreenParamList, 'CharacterDetail'>;

const CharacterDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<CharacterDetailScreenRouteProp>();
  const { characterId } = route.params;

  const drizzleDb = useDrizzle();
  const characterService = createCharacterService(drizzleDb);

  const [character, setCharacter] = useState<CharacterSelect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchCharacter = async () => {
      try {
        setLoading(true);
        const fetchedCharacter = await characterService.getById(characterId);
        if (fetchedCharacter) {
          setCharacter(fetchedCharacter);
        } else {
          setError('Character not found.');
        }
      } catch (err) {
        console.error('Failed to fetch character details:', err);
        setError('Failed to load character details.');
      } finally {
        setLoading(false);
      }
    };

    fetchCharacter();
  }, [characterId]);

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
