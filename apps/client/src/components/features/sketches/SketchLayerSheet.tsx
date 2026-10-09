import {
  MAX_SKETCH_LAYER_NAME_LENGTH,
  MAX_SKETCH_LAYERS,
  type SketchLayerDoc,
} from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../theme';
import { AppAlert } from '../../../utils/AppAlert';
import SketchSlider from './SketchSlider';

interface SketchLayerSheetProps {
  /** Bottom first, as stored; the sheet lists the top layer first. */
  layers: readonly SketchLayerDoc[];
  activeLayerId: string;
  canEdit: boolean;
  onSelectActive: (layerId: string) => void;
  onAdd: () => void;
  onPatch: (
    layerId: string,
    patch: { name?: string; visible?: boolean; opacity?: number; locked?: boolean },
  ) => void;
  onMove: (layerId: string, delta: number) => void;
  onDuplicate: (layerId: string) => void;
  onMergeDown: (layerId: string) => void;
  onClear: (layerId: string) => void;
  onDelete: (layerId: string) => void;
  onClose: () => void;
}

/**
 * Layers of the sketch, top first: pick the one new strokes land on, show/hide, lock, and open a
 * row for opacity, order, duplicate, merge down, clear and delete. A locked or hidden layer takes
 * no strokes. Deleting or clearing a layer asks first; both are undoable from the canvas.
 */
const SketchLayerSheet: React.FC<SketchLayerSheetProps> = ({
  layers,
  activeLayerId,
  canEdit,
  onSelectActive,
  onAdd,
  onPatch,
  onMove,
  onDuplicate,
  onMergeDown,
  onClear,
  onDelete,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const styles = StyleSheet.create({
    sheet: { maxHeight: '82%' },
    block: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
    active: { backgroundColor: colors.border + '55', borderRadius: 8 },
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
    more: { paddingBottom: 10, paddingLeft: 30, gap: 8 },
    moreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    footer: { marginTop: 14 },
  });

  const commitRename = () => {
    if (editingId && editingName.trim()) onPatch(editingId, { name: editingName.trim() });
    setEditingId(null);
  };
  const confirm = (title: string, body: string, action: () => void) =>
    AppAlert.alert(title, body, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: action },
    ]);

  const topFirst = [...layers].reverse();
  return (
    <ResponsiveModal
      visible
      onClose={onClose}
      placement="adaptive"
      tone="raised"
      inset="sheet"
      contentStyle={styles.sheet}
    >
      <ModalHeader title={t('sketch_layers_title')} onClose={onClose} />
      <ScrollView keyboardShouldPersistTaps="handled">
        {topFirst.map((layer, topIndex) => {
          const active = activeLayerId === layer.id;
          const expanded = expandedId === layer.id;
          const isBottom = topIndex === topFirst.length - 1;
          const isTop = topIndex === 0;
          return (
            <View key={layer.id} style={styles.block}>
              <View style={[styles.row, active && styles.active]}>
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
                      {t('sketch_layer_items', { count: layer.items.length })}
                      {` · ${Math.round(layer.opacity * 100)}%`}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => onPatch(layer.id, { visible: !layer.visible })}
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
                  onPress={() => onPatch(layer.id, { locked: !layer.locked })}
                  disabled={!canEdit}
                  style={styles.iconButton}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: layer.locked }}
                  accessibilityLabel={t('sketch_layer_lock', { name: layer.name })}
                >
                  <Ionicons
                    name={layer.locked ? 'lock-closed-outline' : 'lock-open-outline'}
                    size={20}
                    color={layer.locked ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setExpandedId(expanded ? null : layer.id)}
                  style={styles.iconButton}
                  accessibilityLabel={t('sketch_layer_more', { name: layer.name })}
                >
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'ellipsis-horizontal'}
                    size={20}
                    color={colors.text}
                  />
                </TouchableOpacity>
              </View>
              {expanded && canEdit && (
                <View style={styles.more}>
                  <SketchSlider
                    label={t('sketch_opacity')}
                    value={layer.opacity}
                    min={0.05}
                    max={1}
                    valueText={`${Math.round(layer.opacity * 100)}%`}
                    onChange={(opacity) => onPatch(layer.id, { opacity })}
                  />
                  <View style={styles.moreRow}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      disabled={isTop}
                      onPress={() => onMove(layer.id, 1)}
                      accessibilityLabel={t('sketch_layer_up')}
                    >
                      <Ionicons
                        name="arrow-up-outline"
                        size={20}
                        color={isTop ? colors.textSecondary : colors.text}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      disabled={isBottom}
                      onPress={() => onMove(layer.id, -1)}
                      accessibilityLabel={t('sketch_layer_down')}
                    >
                      <Ionicons
                        name="arrow-down-outline"
                        size={20}
                        color={isBottom ? colors.textSecondary : colors.text}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      disabled={layers.length >= MAX_SKETCH_LAYERS}
                      onPress={() => onDuplicate(layer.id)}
                      accessibilityLabel={t('sketch_layer_duplicate')}
                    >
                      <Ionicons name="copy-outline" size={20} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      disabled={isBottom}
                      onPress={() => onMergeDown(layer.id)}
                      accessibilityLabel={t('sketch_layer_merge_down')}
                    >
                      <Ionicons
                        name="git-merge-outline"
                        size={20}
                        color={isBottom ? colors.textSecondary : colors.text}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      disabled={layer.items.length === 0}
                      onPress={() =>
                        confirm(t('sketch_layer_clear_title'), t('sketch_layer_clear_body'), () =>
                          onClear(layer.id),
                        )
                      }
                      accessibilityLabel={t('sketch_layer_clear')}
                    >
                      <Ionicons
                        name="refresh-outline"
                        size={20}
                        color={layer.items.length === 0 ? colors.textSecondary : colors.text}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      disabled={layers.length <= 1}
                      onPress={() =>
                        confirm(t('sketch_layer_delete_title'), t('sketch_layer_delete_body'), () =>
                          onDelete(layer.id),
                        )
                      }
                      accessibilityLabel={t('sketch_layer_delete', { name: layer.name })}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={layers.length <= 1 ? colors.textSecondary : colors.error}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
