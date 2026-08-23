import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChoiceSelect, SceneSelect } from '@/src/db/schema';
import { useTheme } from '@/src/theme';
import SceneListItem from '@/src/components/features/list-items/SceneListItem';
import ChapterSceneBranchTree from './ChapterSceneBranchTree';

interface Props {
  storyType: 'linear' | 'branching' | undefined;
  scenes: SceneSelect[];
  choices: ChoiceSelect[];
  canEdit: boolean;
  onOpenScene: (sceneId: string) => void;
  onToggleFavorite: (sceneId: string, isFavorite: boolean) => void;
  onAddScene: () => void;
  onReorderScenes: () => void;
  expandedSceneIds: ReadonlySet<string>;
  onSceneExpandedChange: (sceneId: string, isExpanded: boolean) => void;
}

const ChapterScenesList: React.FC<Props> = ({
  storyType,
  scenes,
  choices,
  canEdit,
  onOpenScene,
  onToggleFavorite,
  onAddScene,
  onReorderScenes,
  expandedSceneIds,
  onSceneExpandedChange,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sorted = useMemo(
    () => [...scenes].sort((a, b) => a.index - b.index || a.id.localeCompare(b.id)),
    [scenes],
  );
  const styles = useMemo(
    () =>
      StyleSheet.create({
        titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
        title: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', flex: 1 },
        add: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
        addText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
        empty: { color: colors.textSecondary, fontSize: 13, paddingVertical: 8 },
      }),
    [colors],
  );

  return (
    <View>
      <View style={styles.titleRow}>
        <Text style={styles.title}>
          {t('chapter_outline_scene_count', { count: sorted.length })}
        </Text>
        {canEdit && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {sorted.length > 1 && (
              <TouchableOpacity style={styles.add} onPress={onReorderScenes}>
                <Ionicons name="swap-vertical" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.add} onPress={onAddScene}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.addText}>{t('add_scene')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {!sorted.length ? (
        <Text style={styles.empty}>{t('no_scenes_in_chapter')}</Text>
      ) : storyType === 'branching' ? (
        <ChapterSceneBranchTree
          scenes={sorted}
          choices={choices}
          onOpenScene={onOpenScene}
          onToggleFavorite={onToggleFavorite}
          expandedSceneIds={expandedSceneIds}
          onSceneExpandedChange={onSceneExpandedChange}
        />
      ) : (
        sorted.map((scene) => (
          <SceneListItem
            key={scene.id}
            scene={scene}
            storyType="linear"
            density="nested"
            onViewDetails={onOpenScene}
            onToggleFavorite={onToggleFavorite}
            isExpanded={expandedSceneIds.has(scene.id)}
            onExpandedChange={(isExpanded) => onSceneExpandedChange(scene.id, isExpanded)}
          />
        ))
      )}
    </View>
  );
};

export default ChapterScenesList;
