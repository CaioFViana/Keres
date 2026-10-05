import { MAX_SKETCH_LAYERS, MAX_SKETCH_LAYER_NAME_LENGTH, type SketchLayerType } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../theme';
import { AppAlert } from '../../../utils/AppAlert';

/** Count key for overlays on the implicit base layer (no `layerId`). */
export const SKETCH_BASE_LAYER_KEY = '__base';

interface SketchLayerSheetProps {
  layers: SketchLayerType[];
  activeLayerId: string | null;
  canEdit: boolean;
  overlayCounts: Record<string, number>;
  onSelectActive: (layerId: string | null) => void;
  onAdd: () => void;
  onRename: (layerId: string, name: string) => void;
  onToggleVisible: (layerId: string) => void;
  onSetOpacity: (layerId: string, opacity: number) => void;
  onDelete: (layerId: string) => void;
  onClose: () => void;
}

/**
 * Basic layers: a named stack with visibility and opacity. New strokes land on the
 * active layer; deleting a layer deletes its strokes after a confirm. Hidden layers
 * skip hit-testing, rendering and export alike.
 */
const SketchLayerSheet: React.FC<SketchLayerSheetProps> = ({
  layers,
  activeLayerId,
  canEdit,
  overlayCounts,
  onSelectActive,
  onAdd,
  onRename,
  onToggleVisible,
  onSetOpacity,
  onDelete,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
      maxHeight: '78%',
    },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    title: { color: colors.text, fontSize: 19, fontWeight: 'bold', flex: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    name: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
    sub: { color: colors.textSecondary, fontSize: 12 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      borderRadius: 8,
      padding: 8,
      flex: 1,
    },
    iconButton: { padding: 6 },
    footer: { marginTop: 14 },
  });

  const commitRename = () => {
    if (editingId && editingName.trim()) onRename(editingId, editingName.trim());
    setEditingId(null);
  };

  return (
    <ResponsiveModal visible onClose={onClose} placement="adaptive" contentStyle={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('sketch_layers_title')}</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel={t('close')}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          onPress={() => onSelectActive(null)}
          style={styles.row}
          accessibilityRole="radio"
          accessibilityState={{ selected: activeLayerId === null }}
          accessibilityLabel={t('sketch_layer_base')}
        >
          <Ionicons
            name={activeLayerId === null ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={activeLayerId === null ? colors.primary : colors.textSecondary}
          />
          <Text style={styles.name}>{t('sketch_layer_base')}</Text>
          <Text style={styles.sub}>
            {t('sketch_layer_strokes', { count: overlayCounts[SKETCH_BASE_LAYER_KEY] ?? 0 })}
          </Text>
        </TouchableOpacity>
        {layers.map((layer) => {
          const active = activeLayerId === layer.id;
          const count = overlayCounts[layer.id] ?? 0;
          return (
            <View key={layer.id} style={styles.row}>
              <TouchableOpacity
                onPress={() => onSelectActive(layer.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={layer.name}
                style={styles.iconButton}
              >
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={active ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>
              {editingId === layer.id ? (
                <TextInput
                  value={editingName}
                  onChangeText={setEditingName}
                  onSubmitEditing={commitRename}
                  onBlur={commitRename}
                  autoFocus
                  maxLength={MAX_SKETCH_LAYER_NAME_LENGTH}
                  style={styles.input}
                />
              ) : (
                <TouchableOpacity
                  style={{ flex: 1 }}
                  disabled={!canEdit}
                  onPress={() => {
                    setEditingId(layer.id);
                    setEditingName(layer.name);
                  }}
                  accessibilityLabel={t('sketch_layer_rename', { name: layer.name })}
                >
                  <Text style={styles.name}>{layer.name}</Text>
                  <Text style={styles.sub}>
                    {t('sketch_layer_strokes', { count })}
                    {` · ${Math.round(layer.opacity * 100)}%`}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => onToggleVisible(layer.id)}
                disabled={!canEdit}
                style={styles.iconButton}
                accessibilityRole="switch"
                accessibilityState={{ checked: layer.visible }}
                accessibilityLabel={t('sketch_layer_visible', { name: layer.name })}
              >
                <Ionicons
                  name={layer.visible ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={layer.visible ? colors.text : colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onSetOpacity(layer.id, Math.max(0.1, layer.opacity - 0.25))}
                disabled={!canEdit}
                style={styles.iconButton}
                accessibilityLabel={t('sketch_layer_less_opaque')}
              >
                <Ionicons name="remove" size={16} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onSetOpacity(layer.id, Math.min(1, layer.opacity + 0.25))}
                disabled={!canEdit}
                style={styles.iconButton}
                accessibilityLabel={t('sketch_layer_more_opaque')}
              >
                <Ionicons name="add" size={16} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  AppAlert.alert(t('sketch_layer_delete_title'), t('sketch_layer_delete_body'), [
                    { text: t('cancel'), style: 'cancel' },
                    {
                      text: t('delete'),
                      style: 'destructive',
                      onPress: () => onDelete(layer.id),
                    },
                  ])
                }
                disabled={!canEdit}
                style={styles.iconButton}
                accessibilityLabel={t('sketch_layer_delete', { name: layer.name })}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
      {canEdit && layers.length < MAX_SKETCH_LAYERS && (
        <View style={styles.footer}>
          <Button onPress={onAdd}>{t('sketch_layer_add')}</Button>
        </View>
      )}
    </ResponsiveModal>
  );
};

export default SketchLayerSheet;
