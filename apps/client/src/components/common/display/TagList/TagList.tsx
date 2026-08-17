import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { getContrastTextColor, isValidHexColor } from '../../../../utils/colorUtils';

interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

interface TagListProps {
  tags: Tag[];
  /**
   * `compact` (padrão): pill pequena, só leitura - usada nas linhas de lista. `chip`: chip
   * maior e em negrito, com botão de remover opcional - usada nas telas de detalhe.
   */
  variant?: 'compact' | 'chip';
  /** Só faz sentido com `variant="chip"`. */
  onRemoveTag?: (tagId: string) => void;
  /** Se ausente, a lista vazia não renderiza nada (comportamento do `compact`). */
  emptyMessage?: string;
}

const TagList: React.FC<TagListProps> = ({
  tags,
  variant = 'compact',
  onRemoveTag,
  emptyMessage,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isChip = variant === 'chip';

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: isChip ? 10 : 8,
      marginBottom: isChip ? 10 : 0,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: isChip ? 15 : 5,
      paddingVertical: isChip ? 5 : 2,
      paddingHorizontal: isChip ? 10 : 6,
      marginRight: isChip ? 8 : 5,
      marginBottom: isChip ? 8 : 5,
    },
    chipText: {
      fontSize: isChip ? 14 : 12,
      fontWeight: isChip ? 'bold' : 'normal',
    },
    removeButton: {
      marginLeft: 5,
      padding: 2,
    },
  });

  if (!tags || tags.length === 0) {
    if (!emptyMessage) return null;
    return <Text style={{ color: colors.textSecondary }}>{emptyMessage}</Text>;
  }

  return (
    <View style={styles.container}>
      {tags.map((tag) => {
        const fallbackColor = isChip ? colors.primaryContainer : colors.surface;
        const backgroundColor = tag.color && isValidHexColor(tag.color) ? tag.color : fallbackColor;
        const textColor = getContrastTextColor(backgroundColor);

        return (
          <View key={tag.id} style={[styles.chip, { backgroundColor }]}>
            <Text style={[styles.chipText, { color: textColor }]}>{tag.name}</Text>
            {isChip && onRemoveTag && (
              <TouchableOpacity
                onPress={() => onRemoveTag(tag.id)}
                style={styles.removeButton}
                accessibilityLabel={t('remove')}
              >
                <Ionicons name="close-circle" size={18} color={textColor} />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
};

export default TagList;
