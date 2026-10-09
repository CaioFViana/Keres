import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../theme';

export interface CanvasListRowProps {
  /** The leading icon or cover of the entity. */
  leading: React.ReactNode;
  name: string;
  description?: string | null;
  canEdit: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/** A row of a canvas list (boards, location maps, sketches): open, and edit/duplicate/delete when allowed. */
const CanvasListRow: React.FC<CanvasListRowProps> = ({
  leading,
  name,
  description,
  canEdit,
  onPress,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowText: { flex: 1 },
    actionButton: { padding: 8, marginLeft: 4 },
    name: { fontSize: 16, fontWeight: '600', color: colors.text },
    description: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  });

  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      {leading}
      <View style={styles.rowText}>
        <Text style={styles.name}>{name}</Text>
        {!!description && <Text style={styles.description}>{description}</Text>}
      </View>
      {canEdit && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onEdit}
          accessibilityLabel={t('edit')}
        >
          <Ionicons name="pencil-outline" size={21} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
      {canEdit && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onDuplicate}
          accessibilityLabel={t('duplicate')}
        >
          <Ionicons name="copy-outline" size={21} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
      {canEdit && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onDelete}
          accessibilityLabel={t('delete')}
        >
          <Ionicons name="trash-outline" size={21} color={colors.error} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

export default CanvasListRow;
