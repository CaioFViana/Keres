import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';
import { CharacterRelationWithNames } from '../../services/CharacterRelationService';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface CharacterRelationListItemProps {
  relation: CharacterRelationWithNames;
  onViewDetails: (relationId: string) => void;
  // No onToggleFavorite as CharacterRelations don't have a favorite status
}

const CharacterRelationListItem: React.FC<CharacterRelationListItemProps> = ({
  relation,
  onViewDetails,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.card,
      marginBottom: 8,
      borderRadius: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
      elevation: 3,
    },
    textContainer: {
      flex: 1,
      marginRight: 10,
    },
    title: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    details: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    icon: {
      padding: 8,
    },
  });

  return (
    <TouchableOpacity onPress={() => onViewDetails(relation.id)} style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{`${relation.char1Name} - ${relation.char2Name}`}</Text>
        <Text style={styles.details}>{t('relation_type')}: {relation.relationType}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={24}
        color={colors.textSecondary}
        style={styles.icon}
      />
    </TouchableOpacity>
  );
};

export default CharacterRelationListItem;
