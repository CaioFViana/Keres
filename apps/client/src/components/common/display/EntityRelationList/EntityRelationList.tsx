import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';

export interface EntityRelationListItem {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  leading?: React.ReactNode;
  details?: React.ReactNode;
  onPress?: () => void;
  trailing?: React.ReactNode;
  testID?: string;
}

interface Props {
  items: EntityRelationListItem[];
  emptyText: string;
}

/** Shared compact relation rows; managers keep their selection and persistence rules. */
const EntityRelationList: React.FC<Props> = ({ items, emptyText }) => {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    last: { borderBottomWidth: 0 },
    icon: { marginRight: 10 },
    text: { flex: 1, fontSize: 15, color: colors.text },
    textWrap: { flex: 1 },
    empty: { color: colors.textSecondary, fontStyle: 'italic', paddingVertical: 8 },
  });
  if (!items.length) return <Text style={styles.empty}>{emptyText}</Text>;
  return (
    <View>
      {items.map((item, index) => {
        const content = (
          <>
            {item.leading ?? (
              <Ionicons name={item.icon} size={20} color={item.color} style={styles.icon} />
            )}
            <View style={styles.textWrap}>
              {item.title ? (
                <Text style={styles.text} numberOfLines={item.details ? undefined : 1}>
                  {item.title}
                </Text>
              ) : null}
              {item.details}
            </View>
            {item.onPress && (
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            )}
            {item.trailing}
          </>
        );
        const rowStyle = [styles.row, index === items.length - 1 && styles.last];
        return item.onPress ? (
          <TouchableOpacity
            key={item.id}
            style={rowStyle}
            onPress={item.onPress}
            testID={item.testID}
          >
            {content}
          </TouchableOpacity>
        ) : (
          <View key={item.id} style={rowStyle} testID={item.testID}>
            {content}
          </View>
        );
      })}
    </View>
  );
};

export default EntityRelationList;
