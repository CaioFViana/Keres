import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChoiceSelect, SceneSelect } from '@/src/db/schema';
import { useTheme } from '@/src/theme';
import SceneListItem from '@/src/components/features/list-items/SceneListItem';

interface Props {
  scenes: SceneSelect[];
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
  choices,
  onOpenScene,
  onToggleFavorite,
  expandedSceneIds,
  onSceneExpandedChange,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const layers = useMemo(() => buildLayers(scenes, choices), [scenes, choices]);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { marginTop: 4 },
        content: { flexDirection: 'row', gap: 16, paddingBottom: 4 },
        layer: { width: 226, gap: 6 },
        layerHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
        layerText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
      }),
    [colors],
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.scroll}>
      <View style={styles.content}>
        {layers.map((layer, index) => (
          <View key={index} style={styles.layer}>
            <View style={styles.layerHeader}>
              {index > 0 && (
                <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
              )}
              <Text style={styles.layerText}>
                {t('chapter_outline_layer', { count: index + 1 })}
              </Text>
            </View>
            {layer.map((scene) => (
              <SceneListItem
                key={scene.id}
                scene={scene}
                storyType="branching"
                density="nested"
                onViewDetails={onOpenScene}
                onToggleFavorite={onToggleFavorite}
                isExpanded={expandedSceneIds.has(scene.id)}
                onExpandedChange={(isExpanded) => onSceneExpandedChange(scene.id, isExpanded)}
              />
            ))}
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
