import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterRelationWithNames } from '../../services/storymanagement/CharacterRelationService';
import { useTheme } from '../../theme';

/**
 * Linha só de leitura: criar/editar uma relação acontece pelo gerenciador embutido na tela do
 * personagem (`CharacterRelationManager`), e visualizar a rede de relações acontece no mapa
 * (`CharacterRelationGraphScreen`) - esta lista existe para buscar/ordenar, não para navegar.
 */
interface CharacterRelationListItemProps {
  relation: CharacterRelationWithNames;
}

const CharacterRelationListItem: React.FC<CharacterRelationListItemProps> = ({
  relation,
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
  });

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{`${relation.char1Name} - ${relation.char2Name}`}</Text>
        <Text style={styles.details}>{t('relation_type')}: {relation.relationType}</Text>
      </View>
    </View>
  );
};

export default CharacterRelationListItem;
