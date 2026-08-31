import Button from '@/src/components/common/controls/Button/Button';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import RelationRow from '@/src/components/features/relations/RelationManager/RelationRow';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';
import type { PlotScene } from '@keres/shared/entities/PlotScene';
import type { SceneSelect } from '@/src/db/schema';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { useVocabularyEntityCopy } from '../../../../vocabulary/useVocabularyEntityCopy';
import { AppAlert } from '../../../../utils/AppAlert';
import { createULID } from '../../../../utils/entityUtils';
import ScenePlotModal from './ScenePlotModal';

interface PlotSceneManagerProps {
  relations: PlotScene[];
  scenes: SceneSelect[];
  chapterNameOf: (chapterId: string | null | undefined) => string | undefined;
  onSave: (relation: PlotScene) => Promise<void> | void;
  onDelete: (relationId: string) => Promise<void> | void;
  editable: boolean;
  currentStoryId: string;
  currentPlotId: string;
}

/** A plot is the single authoring surface for its scene membership and each scene's plot note. */
const PlotSceneManager: React.FC<PlotSceneManagerProps> = ({
  relations,
  scenes,
  chapterNameOf,
  onSave,
  onDelete,
  editable,
  currentStoryId,
  currentPlotId,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRelation, setEditingRelation] = useState<PlotScene | null>(null);

  const activeRelations = useMemo(
    () => relations.filter((relation) => !relation.isDeleted),
    [relations],
  );
  const activeScenes = useMemo(() => scenes.filter((scene) => !scene.isDeleted), [scenes]);
  const sceneOptions = useMemo(
    () =>
      activeScenes.map((scene) => {
        const chapterName = chapterNameOf(scene.chapterId);
        return { id: scene.id, label: chapterName ? `${scene.name} · ${chapterName}` : scene.name };
      }),
    [activeScenes, chapterNameOf],
  );
  const availableScenes = useMemo(
    () =>
      sceneOptions.filter(
        (scene) => !activeRelations.some((relation) => relation.sceneId === scene.id),
      ),
    [activeRelations, sceneOptions],
  );

  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
    formSection: { marginTop: 20 },
    noteText: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    buttonContainer: { marginBottom: 10 },
    emptyText: { color: colors.textSecondary },
    actionsRow: { flexDirection: 'row', gap: 12 },
  });

  const handleAdd = () => {
    if (availableScenes.length === 0) {
      AppAlert.alert(t('error'), t('no_scenes_to_assign_to_plot'));
      return;
    }
    setEditingRelation(null);
    setIsModalVisible(true);
  };

  const handleDelete = (relationId: string) => {
    AppAlert.alert(
      t('delete_plot_scene_relation_title'),
      t('delete_plot_scene_relation_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => onDelete(relationId) },
      ],
      { cancelable: true },
    );
  };

  const handleModalSave = (sceneId: string, note: string, relationId?: string) => {
    const existing = relationId
      ? activeRelations.find((relation) => relation.id === relationId)
      : undefined;
    onSave({
      id: relationId ?? createULID(),
      storyId: currentStoryId,
      plotId: currentPlotId,
      sceneId,
      note,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
      version: existing?.version ?? 1,
      isDeleted: false,
      deletedAt: null,
    });
    setIsModalVisible(false);
  };

  return (
    <View style={[styles.container, styles.formSection]}>
      <CollapsibleCard title={t('plot_scenes')} initialExpanded>
        {editable ? (
          <View style={styles.buttonContainer}>
            <Button onPress={handleAdd}>{t('add_scene_to_plot')}</Button>
          </View>
        ) : null}
        {activeRelations.length === 0 ? (
          <Text style={styles.emptyText}>{t('no_plot_scenes')}</Text>
        ) : (
          activeRelations.map((relation) => {
            const scene = activeScenes.find((item) => item.id === relation.sceneId);
            const chapterName = scene ? chapterNameOf(scene.chapterId) : undefined;
            return (
              <RelationRow
                key={relation.id}
                extraActions={
                  editable ? (
                    <TouchableOpacity
                      onPress={() => {
                        setEditingRelation(relation);
                        setIsModalVisible(true);
                      }}
                      accessibilityLabel={t('edit_plot_scene_relation')}
                    >
                      <Ionicons name="create-outline" size={22} color={colors.primary} />
                    </TouchableOpacity>
                  ) : undefined
                }
                onRemove={editable ? () => handleDelete(relation.id) : undefined}
              >
                <Text style={styles.relationText}>{scene?.name ?? sceneCopy.notFound}</Text>
                {chapterName ? <Text style={styles.noteText}>{chapterName}</Text> : null}
                <Text style={styles.noteText}>{relation.note}</Text>
              </RelationRow>
            );
          })
        )}
      </CollapsibleCard>

      <ScenePlotModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSave={handleModalSave}
        initialRelation={editingRelation}
        availableScenes={availableScenes}
        allScenes={sceneOptions}
      />
    </View>
  );
};

export default PlotSceneManager;
