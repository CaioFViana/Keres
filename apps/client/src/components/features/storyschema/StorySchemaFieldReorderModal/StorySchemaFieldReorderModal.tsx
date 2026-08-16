import Button from '@/src/components/common/controls/Button/Button';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StorySchemaFieldSelect } from '../../../../db/schema';
import { useTheme } from '../../../../theme';

interface StorySchemaFieldReorderModalProps {
  isVisible: boolean;
  fields: StorySchemaFieldSelect[];
  onClose: () => void;
  onReorderConfirm: (newOrder: { id: string; order: number }[]) => Promise<void>;
}

export function StorySchemaFieldReorderModal({
  isVisible,
  fields,
  onClose,
  onReorderConfirm,
}: StorySchemaFieldReorderModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [reorderedFields, setReorderedFields] = useState<StorySchemaFieldSelect[]>([]);

  useEffect(() => {
    setReorderedFields([...fields].sort((a, b) => a.order - b.order));
  }, [fields, isVisible]);

  const moveField = useCallback((index: number, direction: 'up' | 'down') => {
    setReorderedFields((previous) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!];
      return next;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    await onReorderConfirm(reorderedFields.map((field, order) => ({ id: field.id, order })));
    onClose();
  }, [onClose, onReorderConfirm, reorderedFields]);

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
      paddingVertical: 10,
      paddingHorizontal: 5,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    fieldName: { flex: 1, fontSize: 16, color: colors.text },
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
            <Text style={styles.title}>{t('reorder_attributes_title')}</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel={t('common_cancel')}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={reorderedFields}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <View style={styles.item}>
                <Text style={styles.fieldName}>{item.name}</Text>
                <View style={styles.controls}>
                  <TouchableOpacity
                    accessibilityLabel={`${item.name} up`}
                    disabled={index === 0}
                    onPress={() => moveField(index, 'up')}
                    style={styles.controlButton}
                  >
                    <Ionicons
                      name="arrow-up"
                      size={24}
                      color={index === 0 ? colors.textSecondary : colors.primary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel={`${item.name} down`}
                    disabled={index === reorderedFields.length - 1}
                    onPress={() => moveField(index, 'down')}
                    style={styles.controlButton}
                  >
                    <Ionicons
                      name="arrow-down"
                      size={24}
                      color={
                        index === reorderedFields.length - 1 ? colors.textSecondary : colors.primary
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
          <View style={styles.buttons}>
            <View style={styles.buttonWrapper}>
              <Button onPress={onClose} style={{ backgroundColor: colors.textSecondary }}>
                {t('common_cancel')}
              </Button>
            </View>
            <View style={styles.buttonWrapper}>
              <Button onPress={handleConfirm} style={{ backgroundColor: colors.primary }}>
                {t('common_confirm')}
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
