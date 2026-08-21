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
  /** Já ordenado pelo chamador; a lista interna resincroniza sempre que `items` ou `isVisible`
   * mudam, então reabrir o modal sempre parte da ordem atual, não da última rascunhada. */
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  /** O chamador decide como mapear a lista reordenada pro formato que seu serviço espera
   * (`{id, newIndex}`, `{id, order}`, etc.) - o modal só entrega a ordem final. */
  onReorderConfirm: (reordered: T[]) => Promise<void>;
  /** Slot pra controles extras entre o header e a lista, ex.: o seletor de capítulo do
   * SceneReorderModal. */
  headerExtra?: React.ReactNode;
  emptyListComponent?: React.ReactElement | null;
  confirmDisabled?: boolean;
}

/**
 * `ChapterReorderModal`, `SceneReorderModal` e `StorySchemaFieldReorderModal` reimplementavam,
 * cada um, a mesma modal (overlay, header, `FlatList` com setas pra cima/baixo, botões
 * confirmar/cancelar) - só o tipo da entidade mudava. Aqui genérico em `T`; cada chamador só
 * fornece como identificar/rotular um item e o que fazer com a ordem final.
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
    buttonWrapper: { width: '47%' },
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

          <View style={styles.buttons}>
            <View style={styles.buttonWrapper}>
              <Button onPress={onClose} style={{ backgroundColor: colors.textSecondary }}>
                {t('common_cancel')}
              </Button>
            </View>
            <View style={styles.buttonWrapper}>
              <Button
                onPress={handleConfirm}
                style={{ backgroundColor: colors.primary }}
                disabled={confirmDisabled}
              >
                {t('common_confirm')}
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default ReorderModal;
