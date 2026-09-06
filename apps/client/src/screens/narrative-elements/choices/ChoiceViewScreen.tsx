import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import type { ChoiceCheck } from '@keres/shared/entities/ChoiceCheck';
import type { ChoiceCheckGroup } from '@keres/shared/entities/ChoiceCheckGroup';
import type { Effect } from '@keres/shared/entities/Effect';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoryGraphCanvasHandle } from '@/src/components/features/graphs/StoryGraph/StoryGraphCanvas';
import { useDrizzle } from '../../../db';
import type {
  ChapterSelect,
  ChoiceSelect,
  PlotSceneSelect,
  PlotSelect,
  SceneSelect,
} from '../../../db/schema';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { createChapterService } from '../../../services/storymanagement/ChapterService';
import { createChoiceService } from '../../../services/storymanagement/ChoiceService';
import { createChoiceCheckGroupService } from '../../../services/storymanagement/ChoiceCheckGroupService';
import { createChoiceCheckService } from '../../../services/storymanagement/ChoiceCheckService';
import { createEffectService } from '../../../services/storymanagement/EffectService';
import { createItemService } from '../../../services/storymanagement/ItemService';
import { createPlotSceneService } from '../../../services/storymanagement/PlotSceneService';
import { createPlotService } from '../../../services/storymanagement/PlotService';
import { createSceneService } from '../../../services/storymanagement/SceneService';
import { useNotificationStore } from '../../../state/notificationStore';
import { useStoryStore } from '../../../state/storyStore';
import { useStoryCalendar } from '../../../hooks/useStoryCalendar';
import { useTheme } from '../../../theme';
import { describeChoiceCheck, describeEffect } from '../../../utils/choiceCheckEffectDescriptions';
import type { GraphEdge, GraphNode } from '@keres/shared/graphs/storyGraphLayout';
import { buildStoryGraphLayout } from '@keres/shared/graphs/storyGraphLayout';
import { buildNarrativeProjection } from '@keres/shared';
import { renderStoryMapSvg } from '@keres/shared/graphs/storyGraphSvg';
import { buildStoryMapFileName, deliverSvgMap } from '../../../utils/storyTransfer';
import { entityEventEmitter } from '../../../utils/EventEmitter';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { ChoiceViewContent } from './ChoiceViewContent';

/**
 * The story map: the scenes and the choices that link one to another.
 *
 * It replaces the earlier attempt in WebView + Cytoscape, which loaded the library from a CDN (that is,
 * it did not work offline, in an app whose whole point is working offline) and used a force-directed
 * layout that piled the nodes on top of one another. Here the positioning is computed in
 * `storyGraphLayout` and drawn natively, so the map is the same on every opening, comes out readable
 * and can be exported whole as an image.
 */

/** Above that the choices' text pollutes more than it informs; the user can turn it back on. */
const EDGE_LABEL_AUTO_LIMIT = 40;

interface SceneNodeConnection {
  choiceId: string;
  text: string;
  sceneId: string;
  sceneName: string;
  /** A compact summary of the Choice's checks/effects - undefined when it has none. */
  extra?: string;
}

const ChoiceViewScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { definition: calendar } = useStoryCalendar();
  const navigation =
    useNavigation<NativeStackNavigationProp<NarrativeElementsStackParamList, 'ChoiceView'>>();
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();
  const { showNotification } = useNotificationStore();
  const { isCompact } = useResponsiveLayout();

  const canvasRef = useRef<StoryGraphCanvasHandle>(null);

  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [choices, setChoices] = useState<ChoiceSelect[]>([]);
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
  const [plots, setPlots] = useState<PlotSelect[]>([]);
  const [plotScenes, setPlotScenes] = useState<PlotSceneSelect[]>([]);
  const [selectedPlotIds, setSelectedPlotIds] = useState<string[]>([]);
  const [checkGroups, setCheckGroups] = useState<ChoiceCheckGroup[]>([]);
  const [checks, setChecks] = useState<ChoiceCheck[]>([]);
  const [effects, setEffects] = useState<Effect[]>([]);
  const [itemNamesById, setItemNamesById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [labelsOverride, setLabelsOverride] = useState<boolean | null>(null);
  const [exporting, setExporting] = useState(false);

  const storyId = selectedStory?.id;

  const loadGraph = useCallback(async () => {
    if (!storyId) return;
    try {
      setLoading(true);
      setError(null);
      const [
        loadedScenes,
        loadedChoices,
        loadedChapters,
        loadedCheckGroups,
        loadedChecks,
        loadedEffects,
        loadedItems,
        loadedPlots,
        loadedPlotScenes,
      ] = await Promise.all([
        createSceneService(drizzleDb).getScenesByStoryId(storyId),
        createChoiceService(drizzleDb).getChoicesByStoryId(storyId),
        createChapterService(drizzleDb).getChaptersByStoryId(storyId),
        createChoiceCheckGroupService(drizzleDb).getAllByStoryId(storyId),
        createChoiceCheckService(drizzleDb).getAllByStoryId(storyId),
        createEffectService(drizzleDb).getAllByStoryId(storyId),
        createItemService(drizzleDb).getItemsByStoryId(storyId),
        createPlotService(drizzleDb).getAllByStoryId(storyId),
        createPlotSceneService(drizzleDb).getAllByStoryId(storyId),
      ]);
      setScenes(loadedScenes);
      setChoices(loadedChoices);
      setChapters(loadedChapters);
      setCheckGroups(loadedCheckGroups);
      setChecks(loadedChecks);
      setEffects(loadedEffects);
      setItemNamesById(Object.fromEntries(loadedItems.map((item) => [item.id, item.name])));
      setPlots(loadedPlots);
      setPlotScenes(loadedPlotScenes);
    } catch (loadError) {
      console.log('ChoiceViewScreen: failed to load graph data.', loadError);
      setError(t('failed_to_load_graph_data'));
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, storyId, t]);

  // Recarrega ao focar: cenas e escolhas podem ter mudado em outra tela.
  useFocusEffect(
    useCallback(() => {
      loadGraph();
    }, [loadGraph]),
  );

  useEffect(() => {
    const handleRemoteChange = (change: { storyId?: string }) => {
      if (change?.storyId === storyId) {
        loadGraph();
      }
    };
    entityEventEmitter.on('story_data_changed', handleRemoteChange);
    return () => entityEventEmitter.off('story_data_changed', handleRemoteChange);
  }, [storyId, loadGraph]);

  const isLinearFlow = selectedStory?.type === 'linear';
  const screenTitle = isLinearFlow ? t('story_flow_title') : t('story_map_title');

  useScreenHeader({
    target: 'parent',
    title: screenTitle,
  });

  const graphChoices = useMemo(() => {
    if (!isLinearFlow) return choices;
    return buildNarrativeProjection({
      storyType: 'linear',
      scenes,
      choices: [],
      chapters,
    }).implicitEdges.map((edge, index) => ({
      id: `linear-flow-${index}-${edge.sceneId}-${edge.nextSceneId}`,
      sceneId: edge.sceneId,
      nextSceneId: edge.nextSceneId,
      text: '',
    }));
  }, [chapters, choices, isLinearFlow, scenes]);

  const layout = useMemo(
    () =>
      buildStoryGraphLayout(
        scenes,
        graphChoices,
        chapters,
        isCompact ? 'top-to-bottom' : 'left-to-right',
      ),
    [scenes, graphChoices, chapters, isCompact],
  );

  const showEdgeLabels = labelsOverride ?? layout.edges.length <= EDGE_LABEL_AUTO_LIMIT;

  const selectedNode = useMemo(
    () => layout.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [layout.nodes, selectedNodeId],
  );

  const highlightedNodeIds = useMemo(
    () =>
      selectedPlotIds.length
        ? new Set(
            plotScenes
              .filter((relation) => selectedPlotIds.includes(relation.plotId))
              .map((relation) => relation.sceneId),
          )
        : undefined,
    [plotScenes, selectedPlotIds],
  );

  const sceneNamesById = useMemo(
    () => Object.fromEntries(scenes.map((scene) => [scene.id, scene.name])),
    [scenes],
  );

  // Checks/effects grouped by Choice (through ChoiceCheckGroup) and effects by Scene - only used when
  // they exist, so the majority of Choices/Scenes that have none are not weighed down.
  const checksByChoiceId = useMemo(() => {
    const groupIdToChoiceId = new Map(checkGroups.map((group) => [group.id, group.choiceId]));
    const map = new Map<string, ChoiceCheck[]>();
    for (const check of checks) {
      const choiceId = groupIdToChoiceId.get(check.groupId);
      if (!choiceId) continue;
      if (!map.has(choiceId)) map.set(choiceId, []);
      map.get(choiceId)!.push(check);
    }
    return map;
  }, [checkGroups, checks]);

  const effectsByChoiceId = useMemo(() => {
    const map = new Map<string, Effect[]>();
    for (const effect of effects) {
      if (effect.entityType !== 'Choice') continue;
      if (!map.has(effect.entityId)) map.set(effect.entityId, []);
      map.get(effect.entityId)!.push(effect);
    }
    return map;
  }, [effects]);

  const effectsBySceneId = useMemo(() => {
    const map = new Map<string, Effect[]>();
    for (const effect of effects) {
      if (effect.entityType !== 'Scene') continue;
      if (!map.has(effect.entityId)) map.set(effect.entityId, []);
      map.get(effect.entityId)!.push(effect);
    }
    return map;
  }, [effects]);

  const describeChoiceExtra = useCallback(
    (choiceId: string): string | undefined => {
      const checksForChoice = checksByChoiceId.get(choiceId) ?? [];
      const effectsForChoice = effectsByChoiceId.get(choiceId) ?? [];
      if (checksForChoice.length === 0 && effectsForChoice.length === 0) return undefined;
      return [
        ...checksForChoice.map((check) =>
          describeChoiceCheck(check, sceneNamesById, itemNamesById, t),
        ),
        ...effectsForChoice.map((effect) => describeEffect(effect, itemNamesById, t)),
      ].join(' · ');
    },
    [checksByChoiceId, effectsByChoiceId, sceneNamesById, itemNamesById, t],
  );

  const selectedSceneEffects = selectedNodeId ? (effectsBySceneId.get(selectedNodeId) ?? []) : [];

  const connections = useMemo(() => {
    if (!selectedNodeId)
      return {
        outgoing: [] as SceneNodeConnection[],
        incoming: [] as SceneNodeConnection[],
      };
    const nameById = new Map(layout.nodes.map((node) => [node.id, node.scene.name]));

    const toConnection = (edge: GraphEdge, sceneId: string): SceneNodeConnection => ({
      choiceId: edge.id,
      text: edge.label.trim(),
      sceneId,
      sceneName: nameById.get(sceneId) ?? t('unknown_scene'),
      extra: describeChoiceExtra(edge.id),
    });

    return {
      outgoing: layout.edges
        .filter((edge) => edge.sourceId === selectedNodeId)
        .map((edge) => toConnection(edge, edge.targetId)),
      incoming: layout.edges
        .filter((edge) => edge.targetId === selectedNodeId)
        .map((edge) => toConnection(edge, edge.sourceId)),
    };
  }, [layout.edges, layout.nodes, selectedNodeId, t, describeChoiceExtra]);

  const handleSelectNode = useCallback((node: GraphNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleOpenScene = useCallback(
    (sceneId: string) => {
      setSelectedNodeId(null);
      navigation.navigate('SceneDetail', { sceneId });
    },
    [navigation],
  );

  // The same context line on screen and in the exported file: the printed map and the map open in the app
  // have to say the same thing about what is being shown.
  const mapSubtitle = useMemo(
    () =>
      t(isLinearFlow ? 'story_flow_subtitle' : 'story_map_subtitle', {
        sceneCount: layout.nodes.length,
        choiceCount: layout.edges.length,
        date: new Date().toLocaleDateString(),
      }),
    [isLinearFlow, layout.edges.length, layout.nodes.length, t],
  );

  const handleExport = useCallback(async () => {
    if (!selectedStory || layout.nodes.length === 0) return;

    setExporting(true);
    try {
      const svg = renderStoryMapSvg(layout, {
        title: selectedStory.title,
        subtitle: mapSubtitle,
        showEdgeLabels,
        labels: {
          start: t('story_map_badge_start'),
          finish: t('story_map_badge_finish'),
          loops: t('story_map_legend_loops'),
          detached: t('story_map_badge_detached'),
        },
        colors: {
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
          accent: colors.accent,
          error: colors.error,
        },
      });

      const result = await deliverSvgMap(svg, buildStoryMapFileName(selectedStory.title));
      if (result.delivered) {
        showNotification(t('story_map_export_success', { fileName: result.fileName }), 'success');
      } else {
        // With no share sheet the file exists but the user has no way to reach it; saying where it is is more
        // useful than claiming success.
        showNotification(
          t('story_map_export_no_share_target', {
            path: result.uri || result.fileName,
          }),
          'warning',
        );
      }
    } catch (exportError) {
      console.log('ChoiceViewScreen: failed to export story map.', exportError);
      showNotification(t('story_map_export_failed'), 'error');
    } finally {
      setExporting(false);
    }
  }, [colors, layout, mapSubtitle, selectedStory, showEdgeLabels, showNotification, t]);

  return (
    <ChoiceViewContent
      t={t}
      colors={colors}
      calendar={calendar}
      navigation={navigation}
      canvasRef={canvasRef}
      selectedStory={selectedStory}
      plots={plots}
      selectedPlotIds={selectedPlotIds}
      setSelectedPlotIds={setSelectedPlotIds}
      layout={layout}
      showEdgeLabels={showEdgeLabels}
      highlightedNodeIds={highlightedNodeIds}
      selectedNodeId={selectedNodeId}
      setSelectedNodeId={setSelectedNodeId}
      handleSelectNode={handleSelectNode}
      setLabelsOverride={setLabelsOverride}
      exporting={exporting}
      handleExport={handleExport}
      selectedNode={selectedNode}
      selectedSceneEffects={selectedSceneEffects}
      itemNamesById={itemNamesById}
      connections={connections}
      handleOpenScene={handleOpenScene}
      mapSubtitle={mapSubtitle}
      loading={loading}
      error={error}
    />
  );
};
export default ChoiceViewScreen;
