import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../../../db';
import type { SceneSelect } from '../../../../db/schema';
import { useChapterStore } from '../../../../state/chapterStore';
import { useTheme } from '../../../../theme';
import { buildReorderItems } from '../../../../utils/reorderIndexes';
import Select from '@/src/components/common/inputs/Select/Select';
import ReorderModal from '@/src/components/common/modals/ReorderModal/ReorderModal';

interface SceneReorderModalProps {
  isVisible: boolean;
  onClose: () => void;
  storyId: string;
  scenes: SceneSelect[];
  onReorderConfirm: (
    chapterId: string,
    newOrder: { id: string; newIndex: number }[],
  ) => Promise<void>;
  initialChapterId?: string | null;
}

const SceneReorderModal: React.FC<SceneReorderModalProps> = ({
  isVisible,
  onClose,
  storyId,
  scenes,
  onReorderConfirm,
  initialChapterId = null,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const {
    chapters,
    fetchChapters,
    setDbAndStoryId: setChapterDbAndStoryId,
    initializeService: initializeChapterService,
  } = useChapterStore();

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(initialChapterId);

  useEffect(() => {
    if (isVisible) setSelectedChapterId(initialChapterId);
  }, [initialChapterId, isVisible]);

  useEffect(() => {
    if (drizzleDb && storyId) {
      setChapterDbAndStoryId(drizzleDb, storyId);
      initializeChapterService();
    }
  }, [drizzleDb, storyId, setChapterDbAndStoryId, initializeChapterService]);

  useEffect(() => {
    if (isVisible && storyId) {
      fetchChapters();
    }
  }, [isVisible, storyId, fetchChapters]);

  const sortedScenesInChapter = useMemo(() => {
    if (!selectedChapterId) return [];
    return scenes
      .filter((scene) => scene.chapterId === selectedChapterId)
      .sort((a, b) => a.index - b.index);
  }, [scenes, selectedChapterId]);

  const chapterOptions = useMemo(
    () => chapters.map((chapter) => ({ label: chapter.name, value: chapter.id })),
    [chapters],
  );
  const isChapterLocked = Boolean(initialChapterId);

  const handleConfirm = useCallback(
    async (reordered: SceneSelect[]) => {
      if (!selectedChapterId) return;
      await onReorderConfirm(
        selectedChapterId,
        buildReorderItems(reordered, (scene) => scene.id),
      );
    },
    [selectedChapterId, onReorderConfirm],
  );

  const styles = StyleSheet.create({
    chapterSelectContainer: {
      marginBottom: 20,
      zIndex: 2000, // Ensure dropdown is above other elements
    },
    emptyListText: {
      textAlign: 'center',
      color: colors.textSecondary,
      marginTop: 20,
    },
  });

  return (
    <ReorderModal<SceneSelect>
      isVisible={isVisible}
      onClose={onClose}
      title={t('reorder_scenes_title')}
      items={sortedScenesInChapter}
      getId={(scene) => scene.id}
      getLabel={(scene) => scene.name}
      onReorderConfirm={handleConfirm}
      confirmDisabled={!selectedChapterId || sortedScenesInChapter.length === 0}
      headerExtra={
        isChapterLocked ? undefined : (
          <View style={styles.chapterSelectContainer}>
            <Select
              options={chapterOptions}
              value={selectedChapterId}
              onValueChange={setSelectedChapterId}
              placeholder={t('select_chapter_to_reorder')}
              multiple={false}
            />
          </View>
        )
      }
      emptyListComponent={
        <Text style={styles.emptyListText}>
          {selectedChapterId ? t('no_scenes_in_chapter') : t('select_chapter_to_view_scenes')}
        </Text>
      }
    />
  );
};

export default SceneReorderModal;
