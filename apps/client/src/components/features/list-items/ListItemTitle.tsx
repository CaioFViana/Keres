import React from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Text, View } from 'react-native';
import HighlightedText from '@/src/components/common/lists/SearchHighlight/SearchHighlight';

interface ListItemTitleProps {
  text: string;
  headerLeftStyle: StyleProp<ViewStyle>;
  nameStyle: StyleProp<TextStyle>;
}

/**
 * `<View style={headerLeft}><Text style={name} numberOfLines={1} ellipsizeMode="tail">...` was
 * rewritten identically in every `*ListItem.tsx`
 * (Chapter/Character/Choice/Item/Location/Scene/WorldRule) - only the text and the two styles (which
 * vary by entity) differed.
 */
const ListItemTitle: React.FC<ListItemTitleProps> = ({ text, headerLeftStyle, nameStyle }) => (
  <View style={headerLeftStyle}>
    <Text style={nameStyle} numberOfLines={1} ellipsizeMode="tail">
      <HighlightedText text={text} />
    </Text>
  </View>
);

export default ListItemTitle;
