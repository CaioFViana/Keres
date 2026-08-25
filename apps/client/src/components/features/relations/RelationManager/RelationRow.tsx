import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';

interface RelationRowProps {
  /** The content on the row's left-hand side (name + an optional subtitle, e.g. the relation type). */
  children: React.ReactNode;
  /** It shows the chevron and makes the content tappable when present. */
  onPress?: () => void;
  /** A slot between the chevron and the delete button, e.g. CharacterRelationManager's edit icon. */
  extraActions?: React.ReactNode;
  /** It shows the bin button when present. */
  onRemove?: () => void;
}

/**
 * `CharacterRelationManager` and `LocationRelationManager` (parent/child/connection, 3x) each
 * reimplemented the same "tappable content + chevron + actions" row by hand. Extracted here, and not
 * into `RelationManager`/`GenericRelationDisplay` (which already solve that same problem for their own
 * 5+ call sites) - those have a different interaction rule (the chevron hidden when `editable`) that
 * makes no sense to force here.
 */
const RelationRow: React.FC<RelationRowProps> = ({ children, onPress, extraActions, onRemove }) => {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
  });

  return (
    <View style={styles.relationItem}>
      <TouchableOpacity
        style={styles.relationItemContent}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
      {onPress && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
          style={styles.chevron}
        />
      )}
      {(extraActions || onRemove) && (
        <View style={styles.actionsRow}>
          {extraActions}
          {onRemove && (
            <TouchableOpacity onPress={onRemove}>
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

export default RelationRow;
