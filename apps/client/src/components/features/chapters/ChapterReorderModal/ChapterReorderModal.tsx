import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChapterSelect } from '../../../../db/schema';
import { useTheme } from '../../../../theme';
import Button from '@/src/components/common/controls/Button/Button';

interface ChapterReorderModalProps {
  isVisible: boolean;
  onClose: () => void;
  chapters: ChapterSelect[];
  onReorderConfirm: (newOrder: { id: string, newIndex: number }[]) => Promise<void>;
}

const ChapterReorderModal: React.FC<ChapterReorderModalProps> = ({
  isVisible,
  onClose,
  chapters,
  onReorderConfirm,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [reorderedChapters, setReorderedChapters] = useState<ChapterSelect[]>([]);

  useEffect(() => {
    // Sort chapters by index when the modal opens or chapters prop changes
    setReorderedChapters([...chapters].sort((a, b) => a.index - b.index));
  }, [chapters, isVisible]);

  const moveChapter = useCallback((index: number, direction: 'up' | 'down') => {
    setReorderedChapters(prevChapters => {
      const newChapters = [...prevChapters];
      const chapterToMove = newChapters[index];
      let targetIndex = direction === 'up' ? index - 1 : index + 1;

      // Ensure targetIndex is within bounds
      targetIndex = Math.max(0, Math.min(newChapters.length - 1, targetIndex));

      // Swap elements
      if (targetIndex !== index) {
        newChapters.splice(index, 1); // Remove chapter from original position
        newChapters.splice(targetIndex, 0, chapterToMove); // Insert chapter at new position
      }
      return newChapters;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    // Map the reordered chapters to the format expected by the service
    const newOrder = reorderedChapters.map((chapter, idx) => ({
      id: chapter.id,
      newIndex: idx + 1, // Assign new sequential index based on position
    }));
    await onReorderConfirm(newOrder);
    onClose();
  }, [reorderedChapters, onReorderConfirm, onClose]);

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      width: '90%',
      maxHeight: '80%',
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    chapterItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 5,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    chapterName: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    controls: {
      flexDirection: 'row',
    },
    controlButton: {
      padding: 8,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 20,
    },
    buttonWrapper: {
      width: '47%',
    },
  });

  const renderItem = useCallback(({ item, index }: { item: ChapterSelect, index: number }) => (
    <View style={styles.chapterItem}>
      <Text style={styles.chapterName}>{item.name}</Text>
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => moveChapter(index, 'up')}
          disabled={index === 0}
          style={styles.controlButton}
        >
          <Ionicons name="arrow-up" size={24} color={index === 0 ? colors.textSecondary : colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => moveChapter(index, 'down')}
          disabled={index === reorderedChapters.length - 1}
          style={styles.controlButton}
        >
          <Ionicons name="arrow-down" size={24} color={index === reorderedChapters.length - 1 ? colors.textSecondary : colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  ), [reorderedChapters, moveChapter, colors.primary, colors.textSecondary, styles.chapterItem, styles.chapterName, styles.controlButton, styles.controls]);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('reorder_chapters_title')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={reorderedChapters}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
          />
          <View style={styles.buttonContainer}>
            <View style={styles.buttonWrapper}>
              <Button onPress={onClose} style={{ backgroundColor: colors.textSecondary }}>{t('common_cancel')}</Button>
            </View>
            <View style={styles.buttonWrapper}>
              <Button onPress={handleConfirm} style={{ backgroundColor: colors.primary }}>{t('common_confirm')}</Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ChapterReorderModal;
