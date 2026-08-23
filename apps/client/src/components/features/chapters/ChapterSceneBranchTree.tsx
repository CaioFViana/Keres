import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChoiceSelect, SceneSelect } from '@/src/db/schema';
import { useTheme } from '@/src/theme';
import SceneListItem from '@/src/components/features/list-items/SceneListItem';

interface Props {
  /** Cenas visíveis, que podem estar filtradas pela busca. */
  scenes: SceneSelect[];
  /** Estrutura integral do capítulo, usada para preservar números de camada ao filtrar. */
  allChapterScenes: SceneSelect[];
  choices: ChoiceSelect[];
  onOpenScene: (sceneId: string) => void;
  onToggleFavorite: (sceneId: string, isFavorite: boolean) => void;
  expandedSceneIds: ReadonlySet<string>;
  onSceneExpandedChange: (sceneId: string, isExpanded: boolean) => void;
}

/**
 * Árvore local de um capítulo. Só liga escolhas cujo alvo também pertence ao capítulo: uma
 * transição a outro capítulo não deve fingir que a árvore deste capítulo a contém.
 */
const ChapterSceneBranchTree: React.FC<Props> = ({
  scenes,
  allChapterScenes,
  choices,
  onOpenScene,
  onToggleFavorite,
  expandedSceneIds,
  onSceneExpandedChange,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const layers = useMemo(() => {
    const visibleIds = new Set(scenes.map((scene) => scene.id));
    return buildLayers(allChapterScenes, choices)
      .map((layer, sourceIndex) => ({
        sourceIndex,
        scenes: layer.filter((scene) => visibleIds.has(scene.id)),
      }))
      .filter((layer) => layer.scenes.length > 0);
  }, [allChapterScenes, choices, scenes]);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { marginTop: 4 },
        content: { gap: 12, paddingBottom: 4 },
        layer: { gap: 6 },
        layerHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
        layerText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
        sceneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
        // A single scene should use the entire layer width; siblings still wrap into columns
        // on wider screens instead of leaving a narrow card at the left edge.
        sceneCard: { flexGrow: 1, flexBasis: 250, minWidth: 220 },
      }),
    [colors],
  );

  return (
    <ScrollView style={styles.scroll} nestedScrollEnabled>
      <View style={styles.content}>
        {layers.map((layer) => (
          <View key={layer.sourceIndex} style={styles.layer}>
            <View style={styles.layerHeader}>
              {layer.sourceIndex > 0 && (
                <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
              )}
              <Text style={styles.layerText}>
                {t('chapter_outline_layer', { count: layer.sourceIndex + 1 })}
              </Text>
            </View>
            <View style={styles.sceneRow}>
              {layer.scenes.map((scene) => (
                <View key={scene.id} style={styles.sceneCard}>
                  <SceneListItem
                    scene={scene}
                    storyType="branching"
                    density="nested"
                    onViewDetails={onOpenScene}
                    onToggleFavorite={onToggleFavorite}
                    isExpanded={expandedSceneIds.has(scene.id)}
                    onExpandedChange={(isExpanded) => onSceneExpandedChange(scene.id, isExpanded)}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

function buildLayers(scenes: SceneSelect[], choices: ChoiceSelect[]): SceneSelect[][] {
  const ordered = [...scenes].sort((a, b) => a.index - b.index || a.id.localeCompare(b.id));
  const ids = new Set(ordered.map((scene) => scene.id));
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map(ordered.map((scene) => [scene.id, 0]));
  choices.forEach((choice) => {
    if (!ids.has(choice.sceneId) || !ids.has(choice.nextSceneId)) return;
    outgoing.set(choice.sceneId, [...(outgoing.get(choice.sceneId) ?? []), choice.nextSceneId]);
    incomingCount.set(choice.nextSceneId, (incomingCount.get(choice.nextSceneId) ?? 0) + 1);
  });
  const layerById = new Map<string, number>();
  const queue = ordered.filter((scene) => (incomingCount.get(scene.id) ?? 0) === 0);
  queue.forEach((scene) => layerById.set(scene.id, 0));
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const scene = queue[cursor];
    const layer = layerById.get(scene.id) ?? 0;
    (outgoing.get(scene.id) ?? []).forEach((targetId) => {
      const nextLayer = layer + 1;
      if (!layerById.has(targetId)) {
        layerById.set(targetId, nextLayer);
        queue.push(ordered.find((candidate) => candidate.id === targetId)!);
      }
    });
  }
  // Ciclos e cenas isoladas ainda precisam aparecer de forma estável.
  let fallbackLayer = Math.max(-1, ...layerById.values()) + 1;
  ordered.forEach((scene) => {
    if (!layerById.has(scene.id)) layerById.set(scene.id, fallbackLayer++);
  });
  const layers: SceneSelect[][] = [];
  ordered.forEach((scene) => {
    const layer = layerById.get(scene.id) ?? 0;
    (layers[layer] ??= []).push(scene);
  });
  return layers;
}

export default ChapterSceneBranchTree;
