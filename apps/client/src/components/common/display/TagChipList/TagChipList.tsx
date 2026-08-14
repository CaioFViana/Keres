import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TagSelect } from '../../../../db/schema';
import { useTheme } from '../../../../theme';
import { getContrastTextColor } from '../../../../utils/colorUtils'; // Import the utility

interface TagChipListProps {
  tags: TagSelect[];
  onRemoveTag?: (tagId: string) => void;
  entityType?: 'Character' | 'Note' | 'WorldRule'; // Optional, for context if needed
}

const TagChipList: React.FC<TagChipListProps> = ({ tags, onRemoveTag }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 10,
      marginBottom: 10,
    },
    chip: {
      flexDirection: 'row',
      borderRadius: 15,
      paddingVertical: 5,
      paddingHorizontal: 10,
      marginRight: 8,
      marginBottom: 8,
      alignItems: 'center',
    },
    chipText: {
      fontSize: 14,
      fontWeight: 'bold',
    },
    removeButton: {
      marginLeft: 5,
      padding: 2,
    },
  });

  if (!tags || tags.length === 0) {
    return <Text style={{ color: colors.textSecondary }}>{t('no_tags_found')}</Text>;
  }

  return (
    <View style={styles.container}>
      {tags.map((tag) => {
        const chipBackgroundColor = tag.color || colors.primaryContainer;
        const chipTextColor = getContrastTextColor(chipBackgroundColor);

        return (
          <View key={tag.id} style={[styles.chip, { backgroundColor: chipBackgroundColor }]}>
            <Text style={[styles.chipText, { color: chipTextColor }]}>{tag.name}</Text>
            {onRemoveTag && (
              <TouchableOpacity onPress={() => onRemoveTag(tag.id)} style={styles.removeButton}>
                <Ionicons name="close-circle" size={18} color={chipTextColor} />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
};

export default TagChipList;
