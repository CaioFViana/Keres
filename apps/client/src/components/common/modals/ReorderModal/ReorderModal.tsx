import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import { useTheme } from '../../../../theme';

interface ReorderModalProps<T> {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  /**
   * Already sorted by the caller; the internal list resyncs whenever `items` or `isVisible` change, so
   * reopening the modal always starts from the current order, not from the last draft.
   */
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  /**
   * The caller decides how to map the reordered list into the format its service expects
   * (`{id, newIndex}`, `{id, order}`, etc.) - the modal only hands over the final order.
   */
  onReorderConfirm: (reordered: T[]) => Promise<void>;
  /**
   * A slot for extra controls between the header and the list, e.g. SceneReorderModal's chapter picker.
   */
  headerExtra?: React.ReactNode;
  emptyListComponent?: React.ReactElement | null;
  confirmDisabled?: boolean;
}

/**
 * `ChapterReorderModal`, `SceneReorderModal` and `StorySchemaFieldReorderModal` each reimplemented the
 * same modal (overlay, header, `FlatList` with up/down arrows, confirm/cancel buttons) - only the
 * entity's type differed. Here it is generic in `T`; each caller only supplies how to identify/label an
 * item and what to do with the final order.
 */
function ReorderModal<T>({
  isVisible,
  onClose,
  title,
  items,
  getId,
  getLabel,
  onReorderConfirm,
  headerExtra,
  emptyListComponent,
  confirmDisabled,
}: ReorderModalProps<T>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [reorderedItems, setReorderedItems] = useState<T[]>([]);

  useEffect(() => {
    setReorderedItems(items);
  }, [items, isVisible]);

  const moveItem = useCallback((index: number, direction: 'up' | 'down') => {
    setReorderedItems((previous) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!];
      return next;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    await onReorderConfirm(reorderedItems);
    onClose();
  }, [onClose, onReorderConfirm, reorderedItems]);

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    content: {
      width: '90%',
      maxHeight: '80%',
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    title: { flex: 1, fontSize: 20, fontWeight: 'bold', color: colors.text },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 5,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    itemLabel: { flex: 1, fontSize: 16, color: colors.text },
    controls: { flexDirection: 'row' },
    controlButton: { padding: 8 },
    buttons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  });

  return (
    <Modal animationType="fade" transparent visible={isVisible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel={t('common_cancel')}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {headerExtra}

          <FlatList
            data={reorderedItems}
            keyExtractor={getId}
            ListEmptyComponent={emptyListComponent}
            renderItem={({ item, index }) => {
              const label = getLabel(item);
              return (
                <View style={styles.item}>
                  <Text style={styles.itemLabel}>{label}</Text>
                  <View style={styles.controls}>
                    <TouchableOpacity
                      accessibilityLabel={`${label} up`}
                      disabled={index === 0}
                      onPress={() => moveItem(index, 'up')}
                      style={styles.controlButton}
                    >
                      <Ionicons
                        name="arrow-up"
                        size={24}
                        color={index === 0 ? colors.textSecondary : colors.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityLabel={`${label} down`}
                      disabled={index === reorderedItems.length - 1}
                      onPress={() => moveItem(index, 'down')}
                      style={styles.controlButton}
                    >
                      <Ionicons
                        name="arrow-down"
                        size={24}
                        color={
                          index === reorderedItems.length - 1
                            ? colors.textSecondary
                            : colors.primary
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />

          <FormActions>
            <Button onPress={onClose} style={{ backgroundColor: colors.textSecondary }}>
              {t('common_cancel')}
            </Button>
            <Button
              onPress={handleConfirm}
              style={{ backgroundColor: colors.primary }}
              disabled={confirmDisabled}
            >
              {t('common_confirm')}
            </Button>
          </FormActions>
        </View>
      </View>
    </Modal>
  );
}

export default ReorderModal;
