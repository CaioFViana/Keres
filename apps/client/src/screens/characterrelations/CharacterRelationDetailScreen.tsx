import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { RouteProp, useRoute } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterRelationsStackParamList } from '../../navigation/MainSystemStack'; // Import the param list
import { useTheme } from '../../theme';

export type CharacterRelationDetailScreenRouteProp = RouteProp<CharacterRelationsStackParamList, 'CharacterRelationDetail'>;

const CharacterRelationDetailScreen: React.FC = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const route = useRoute<CharacterRelationDetailScreenRouteProp>();
  const { relationId } = route.params;

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
      <Text style={styles.title}>Character Relation Detail</Text>
      <Text style={styles.detailText}>Relation ID: {relationId}</Text>
      <Text style={styles.detailText}>(This is a placeholder screen)</Text>
    </View>
  );
};

export default CharacterRelationDetailScreen;