import React from 'react';
import { StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';

interface ListItemTitleProps {
  text: string;
  headerLeftStyle: StyleProp<ViewStyle>;
  nameStyle: StyleProp<TextStyle>;
}

/**
 * `<View style={headerLeft}><Text style={name} numberOfLines={1} ellipsizeMode="tail">...`
 * era reescrito idêntico em cada `*ListItem.tsx` (Chapter/Character/Choice/Item/Location/
 * Scene/WorldRule) - só o texto e os dois estilos (que variam por entidade) mudavam.
 */
const ListItemTitle: React.FC<ListItemTitleProps> = ({ text, headerLeftStyle, nameStyle }) => (
  <View style={headerLeftStyle}>
    <Text style={nameStyle} numberOfLines={1} ellipsizeMode="tail">
      {text}
    </Text>
  </View>
);

export default ListItemTitle;
