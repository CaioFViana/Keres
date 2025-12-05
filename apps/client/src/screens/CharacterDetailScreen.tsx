import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme'; // Assuming you have a useTheme hook

// Define the parameter list for this screen
export type CharacterDetailScreenParamList = {
  CharacterDetail: { characterId: string };
};

type CharacterDetailScreenRouteProp = RouteProp<CharacterDetailScreenParamList, 'CharacterDetail'>;

const CharacterDetailScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<CharacterDetailScreenRouteProp>();
  const { characterId } = route.params;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
    detailText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 5,
    },
    buttonContainer: {
      marginTop: 20,
    }
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Character Details</Text>
      <Text style={styles.detailText}>Character ID: {characterId}</Text>
      <Text style={styles.detailText}>This is a dedicated screen for character details.</Text>
      <Text style={styles.detailText}>More character-specific information and editing options will go here.</Text>
      <View style={styles.buttonContainer}>
        <Button title="Go Back" onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </View>
  );
};

export default CharacterDetailScreen;
