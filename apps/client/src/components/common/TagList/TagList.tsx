import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme';
import { isValidHexColor, getContrastTextColor } from '../../../utils/colorUtils';

interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

interface TagListProps {
  tags: Tag[];
}

const TagList: React.FC<TagListProps> = ({ tags }) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    tagContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 8,
    },
    tag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      marginRight: 5,
      marginBottom: 5,
      fontSize: 12,
    },
  });

  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <View style={styles.tagContainer}>
      {tags.map(tag => {
        const tagColorFromDb = tag.color;
        const tagBackgroundColor = (tagColorFromDb && isValidHexColor(tagColorFromDb)) ? tagColorFromDb : colors.surface;
        const tagTextColor = getContrastTextColor(tagBackgroundColor);

        return (
          <Text key={tag.id} style={[styles.tag, { backgroundColor: tagBackgroundColor, color: tagTextColor }]}>
            {tag.name}
          </Text>
        );
      })}
    </View>
  );
};

export default TagList;
