import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { RouteProp, useRoute } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterRelationsStackParamList } from '../../navigation/MainSystemStack'; // Import the param list
import { useTheme } from '../../theme';

export type CharacterRelationFormScreenRouteProp = RouteProp<CharacterRelationsStackParamList, 'CharacterRelationForm'>;

const CharacterRelationFormScreen: React.FC = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const route = useRoute<CharacterRelationFormScreenRouteProp>();
  const { characterRelationId } = route.params;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
      justifyContent: 'center',
      alignItems: 'center',
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
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Character Relation Form</Text>
      {characterRelationId ? (
        <Text style={styles.detailText}>Editing Relation ID: {characterRelationId}</Text>
      ) : (
        <Text style={styles.detailText}>Creating New Relation</Text>
      )}
      <Text style={styles.detailText}>(This is a placeholder screen)</Text>
    </View>
  );
};

export default CharacterRelationFormScreen;
