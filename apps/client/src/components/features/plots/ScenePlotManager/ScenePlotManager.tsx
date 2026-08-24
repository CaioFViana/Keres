import Button from '@/src/components/common/controls/Button/Button';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import PlotSceneModal from '@/src/components/features/plots/ScenePlotManager/PlotSceneModal';
import RelationRow from '@/src/components/features/relations/RelationManager/RelationRow';
import { relationSectionStyleDefs } from '@/src/components/features/relations/RelationManager/relationSectionStyles';
import { Ionicons } from '@expo/vector-icons';
import type { Plot } from '@keres/shared/entities/Plot';
import type { PlotScene } from '@keres/shared/entities/PlotScene';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { AppAlert } from '../../../../utils/AppAlert';
import { createULID } from '../../../../utils/entityUtils';

interface ScenePlotManagerProps {
  relations: PlotScene[];
  plots: Plot[];
  onSave: (relation: PlotScene) => Promise<void> | void;
  onDelete: (relationId: string) => Promise<void> | void;
  editable: boolean;
  currentStoryId: string;
  currentSceneId: string;
}

/**
 * As tramas de que esta cena participa, com a nota de uma linha de cada uma. Mesmo formato das
 * relações de personagem: card colapsável, linhas com ações e um modal para adicionar/editar -
 * a cena é o único lugar onde essa relação é editada.
 */
const ScenePlotManager: React.FC<ScenePlotManagerProps> = ({
  relations,
  plots,
  onSave,
  onDelete,
  editable,
  currentStoryId,
  currentSceneId,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRelation, setEditingRelation] = useState<PlotScene | null>(null);

  const activeRelations = useMemo(
    () => relations.filter((relation) => !relation.isDeleted),
    [relations],
  );
  const activePlots = useMemo(() => plots.filter((plot) => !plot.isDeleted), [plots]);
  const availablePlots = useMemo(
    () =>
      activePlots.filter(
        (plot) => !activeRelations.some((relation) => relation.plotId === plot.id),
      ),
    [activePlots, activeRelations],
  );

  const styles = StyleSheet.create({
    ...relationSectionStyleDefs(colors),
    noteText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    buttonContainer: {
      marginBottom: 10,
    },
    emptyText: {
      color: colors.textSecondary,
    },
  });

  const handleAdd = () => {
    if (activePlots.length === 0) {
      AppAlert.alert(t('error'), t('no_plots_to_assign'));
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

  const handleModalSave = (plotId: string, note: string, relationId?: string) => {
    const existing = relationId
      ? activeRelations.find((relation) => relation.id === relationId)
      : undefined;
    onSave({
      id: relationId ?? createULID(),
      storyId: currentStoryId,
      plotId,
      sceneId: currentSceneId,
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
    <View style={styles.container}>
      <CollapsibleCard title={t('scene_plots_title')} initialExpanded={false}>
        <View>
          {editable && (
            <View style={styles.buttonContainer}>
              <Button onPress={handleAdd}>{t('add_plot_scene_relation')}</Button>
            </View>
          )}

          {activeRelations.length === 0 ? (
            <Text style={styles.emptyText}>{t('no_scene_plots')}</Text>
          ) : (
            <View>
              {activeRelations.map((relation) => (
                <RelationRow
                  key={relation.id}
                  extraActions={
                    editable && (
                      <TouchableOpacity
                        onPress={() => {
                          setEditingRelation(relation);
                          setIsModalVisible(true);
                        }}
                        accessibilityLabel={t('edit_plot_scene_relation')}
                      >
                        <Ionicons name="create-outline" size={22} color={colors.primary} />
                      </TouchableOpacity>
                    )
                  }
                  onRemove={editable ? () => handleDelete(relation.id) : undefined}
                >
                  <Text style={styles.relationText}>
                    {activePlots.find((plot) => plot.id === relation.plotId)?.name ??
                      t('plot_not_found')}
                  </Text>
                  <Text style={styles.noteText}>{relation.note}</Text>
                </RelationRow>
              ))}
            </View>
          )}
        </View>
      </CollapsibleCard>

      <PlotSceneModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSave={handleModalSave}
        initialRelation={editingRelation}
        availablePlots={availablePlots}
        allPlots={activePlots}
      />
    </View>
  );
};

export default ScenePlotManager;
