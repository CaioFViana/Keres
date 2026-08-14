import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../../../db'; // Import useDrizzle
import { SceneSelect } from '../../../../db/schema';
import { useChapterStore } from '../../../../state/chapterStore'; // Import useChapterStore
import { useTheme } from '../../../../theme';
import Button from '@/src/components/common/controls/Button/Button';
import Select from '@/src/components/common/inputs/Select/Select'; // Import Select component

interface SceneReorderModalProps {
  isVisible: boolean;
  onClose: () => void;
  storyId: string; // Add storyId prop
  scenes: SceneSelect[];
  onReorderConfirm: (
    chapterId: string,
    newOrder: { id: string; newIndex: number }[],
  ) => Promise<void>; // Update signature
}

const SceneReorderModal: React.FC<SceneReorderModalProps> = ({
  isVisible,
  onClose,
  storyId,
  scenes,
  onReorderConfirm,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle(); // Get drizzleDb from useDrizzle
  const {
    chapters,
    fetchChapters,
    setDbAndStoryId: setChapterDbAndStoryId,
    initializeService: initializeChapterService,
  } = useChapterStore();

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [reorderedScenes, setReorderedScenes] = useState<SceneSelect[]>([]);

  // Initialize Chapter Service
  useEffect(() => {
    if (drizzleDb && storyId) {
      setChapterDbAndStoryId(drizzleDb, storyId);
      initializeChapterService();
    }
  }, [drizzleDb, storyId, setChapterDbAndStoryId, initializeChapterService]);

  // Fetch chapters when modal becomes visible or storyId changes
  useEffect(() => {
    if (isVisible && storyId) {
      fetchChapters();
    }
  }, [isVisible, storyId, fetchChapters]);

  // Filter scenes based on selected chapter
  const filteredScenes = useMemo(() => {
    if (!selectedChapterId) {
      return [];
    }
    return scenes.filter((scene) => scene.chapterId === selectedChapterId);
  }, [scenes, selectedChapterId]);

  useEffect(() => {
    // Sort filtered scenes by index when the modal opens or filteredScenes changes
    setReorderedScenes([...filteredScenes].sort((a, b) => a.index - b.index));
  }, [filteredScenes, isVisible]);

  const moveScene = useCallback((index: number, direction: 'up' | 'down') => {
    setReorderedScenes((prevScenes) => {
      const newScenes = [...prevScenes];
      const sceneToMove = newScenes[index];
      let targetIndex = direction === 'up' ? index - 1 : index + 1;

      // Ensure targetIndex is within bounds
      targetIndex = Math.max(0, Math.min(newScenes.length - 1, targetIndex));

      // Swap elements
      if (targetIndex !== index) {
        newScenes.splice(index, 1); // Remove scene from original position
        newScenes.splice(targetIndex, 0, sceneToMove); // Insert scene at new position
      }
      return newScenes;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedChapterId) {
      // Should ideally not happen if the confirm button is disabled until a chapter is selected
      console.warn('No chapter selected for reordering scenes.');
      return;
    }
    // Map the reordered scenes to the format expected by the service
    const newOrder = reorderedScenes.map((scene, idx) => ({
      id: scene.id,
      newIndex: idx + 1, // Assign new sequential index based on position
    }));
    await onReorderConfirm(selectedChapterId, newOrder); // Pass selectedChapterId
    onClose();
  }, [selectedChapterId, reorderedScenes, onReorderConfirm, onClose]);

  const chapterOptions = useMemo(() => {
    return chapters.map((chapter) => ({ label: chapter.name, value: chapter.id }));
  }, [chapters]);

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
    chapterSelectContainer: {
      marginBottom: 20,
      zIndex: 2000, // Ensure dropdown is above other elements
    },
    sceneItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 5,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sceneName: {
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
      zIndex: 1, // Ensure buttons are clickable
    },
    buttonWrapper: {
      width: '47%',
    },
    emptyListText: {
      textAlign: 'center',
      color: colors.textSecondary,
      marginTop: 20,
    },
  });

  const renderItem = useCallback(
    ({ item, index }: { item: SceneSelect; index: number }) => (
      <View style={styles.sceneItem}>
        <Text style={styles.sceneName}>{item.name}</Text>
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={() => moveScene(index, 'up')}
            disabled={index === 0}
            style={styles.controlButton}
          >
            <Ionicons
              name="arrow-up"
              size={24}
              color={index === 0 ? colors.textSecondary : colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => moveScene(index, 'down')}
            disabled={index === reorderedScenes.length - 1}
            style={styles.controlButton}
          >
            <Ionicons
              name="arrow-down"
              size={24}
              color={index === reorderedScenes.length - 1 ? colors.textSecondary : colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [
      reorderedScenes,
      moveScene,
      colors.primary,
      colors.textSecondary,
      styles.controlButton,
      styles.controls,
      styles.sceneItem,
      styles.sceneName,
    ],
  );

  return (
    <Modal animationType="fade" transparent={true} visible={isVisible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('reorder_scenes_title')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.chapterSelectContainer}>
            <Select
              options={chapterOptions}
              value={selectedChapterId}
              onValueChange={setSelectedChapterId}
              placeholder={t('select_chapter_to_reorder')}
              multiple={false}
            />
          </View>

          {selectedChapterId && reorderedScenes.length === 0 && (
            <Text style={styles.emptyListText}>{t('no_scenes_in_chapter')}</Text>
          )}

          <FlatList
            data={reorderedScenes}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              !selectedChapterId ? (
                <Text style={styles.emptyListText}>{t('select_chapter_to_view_scenes')}</Text>
              ) : null
            }
          />
          <View style={styles.buttonContainer}>
            <View style={styles.buttonWrapper}>
              <Button onPress={onClose} style={{ backgroundColor: colors.textSecondary }}>
                {t('common_cancel')}
              </Button>
            </View>
            <View style={styles.buttonWrapper}>
              <Button
                onPress={handleConfirm}
                style={{ backgroundColor: colors.primary }}
                disabled={!selectedChapterId || reorderedScenes.length === 0}
              >
                {t('common_confirm')}
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SceneReorderModal;
