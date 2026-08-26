import { Ionicons } from '@expo/vector-icons';
import { commonScreenStyleDefs, commonDetailStyleDefs } from '../../../theme/commonStyles';
import type { ChoiceCheck } from '@keres/shared/entities/ChoiceCheck';
import type { ChoiceCheckGroup } from '@keres/shared/entities/ChoiceCheckGroup';
import type { Effect } from '@keres/shared/entities/Effect';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import GraphNodeSheet from '@/src/components/features/graphs/GraphNodeSheet/GraphNodeSheet';
import type { StoryGraphCanvasHandle } from '@/src/components/features/graphs/StoryGraph/StoryGraphCanvas';
import StoryGraphCanvas from '@/src/components/features/graphs/StoryGraph/StoryGraphCanvas';
import { useDrizzle } from '../../../db';
import type { ChapterSelect, ChoiceSelect, SceneSelect } from '../../../db/schema';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { createChapterService } from '../../../services/storymanagement/ChapterService';
import { createChoiceService } from '../../../services/storymanagement/ChoiceService';
import { createChoiceCheckGroupService } from '../../../services/storymanagement/ChoiceCheckGroupService';
import { createChoiceCheckService } from '../../../services/storymanagement/ChoiceCheckService';
import { createEffectService } from '../../../services/storymanagement/EffectService';
import { createItemService } from '../../../services/storymanagement/ItemService';
import { createSceneService } from '../../../services/storymanagement/SceneService';
import { useNotificationStore } from '../../../state/notificationStore';
import { useStoryStore } from '../../../state/storyStore';
import { useTheme } from '../../../theme';
import { setDocumentTitle } from '../../../utils/documentTitle';
import { describeChoiceCheck, describeEffect } from '../../../utils/choiceCheckEffectDescriptions';
import {
  formatSceneGap,
  formatSceneUniverseDuration,
  hasSceneGap,
  hasSceneUniverseDuration,
} from '../../../utils/sceneTiming';
import type { GraphEdge, GraphNode } from '@keres/shared/graphs/storyGraphLayout';
import { buildStoryGraphLayout } from '@keres/shared/graphs/storyGraphLayout';
import { renderStoryMapSvg } from '@keres/shared/graphs/storyGraphSvg';
import { buildStoryMapFileName, deliverSvgMap } from '../../../utils/storyTransfer';
import { entityEventEmitter } from '../../../utils/EventEmitter';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';

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
      ] = await Promise.all([
        createSceneService(drizzleDb).getScenesByStoryId(storyId),
        createChoiceService(drizzleDb).getChoicesByStoryId(storyId),
        createChapterService(drizzleDb).getChaptersByStoryId(storyId),
        createChoiceCheckGroupService(drizzleDb).getAllByStoryId(storyId),
        createChoiceCheckService(drizzleDb).getAllByStoryId(storyId),
        createEffectService(drizzleDb).getAllByStoryId(storyId),
        createItemService(drizzleDb).getItemsByStoryId(storyId),
      ]);
      setScenes(loadedScenes);
      setChoices(loadedChoices);
      setChapters(loadedChapters);
      setCheckGroups(loadedCheckGroups);
      setChecks(loadedChecks);
      setEffects(loadedEffects);
      setItemNamesById(Object.fromEntries(loadedItems.map((item) => [item.id, item.name])));
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

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('story_map_title'));
      navigation.getParent()?.setOptions({ title: t('story_map_title'), headerRight: undefined });
    }, [navigation, t]),
  );

  const layout = useMemo(
    () =>
      buildStoryGraphLayout(
        scenes,
        choices,
        chapters,
        isCompact ? 'top-to-bottom' : 'left-to-right',
      ),
    [scenes, choices, chapters, isCompact],
  );

  const showEdgeLabels = labelsOverride ?? layout.edges.length <= EDGE_LABEL_AUTO_LIMIT;

  const selectedNode = useMemo(
    () => layout.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [layout.nodes, selectedNodeId],
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
      return { outgoing: [] as SceneNodeConnection[], incoming: [] as SceneNodeConnection[] };
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
      t('story_map_subtitle', {
        sceneCount: layout.nodes.length,
        choiceCount: layout.edges.length,
        date: new Date().toLocaleDateString(),
      }),
    [layout.edges.length, layout.nodes.length, t],
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
          t('story_map_export_no_share_target', { path: result.uri || result.fileName }),
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        ...commonScreenStyleDefs(colors),
        ...commonDetailStyleDefs(colors),
        header: {
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          paddingTop: 9,
          paddingBottom: 3,
        },
        headerTitle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: colors.text,
          paddingHorizontal: 12,
        },
        headerSubtitle: {
          fontSize: 11,
          color: colors.textSecondary,
          paddingHorizontal: 12,
          marginTop: 1,
        },
        legendBar: {
          // Without this the horizontal ScrollView stretches vertically and eats half the screen: inside a column
          // container it grows along the cross axis by default.
          flexGrow: 0,
          flexShrink: 0,
        },
        legendContent: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
        legendChip: {
          flexDirection: 'row',
          alignItems: 'center',
          marginRight: 14,
        },
        legendSwatch: {
          width: 11,
          height: 11,
          borderRadius: 3,
          marginRight: 5,
        },
        legendOutline: {
          width: 11,
          height: 11,
          borderRadius: 3,
          borderWidth: 2,
          marginRight: 5,
        },
        legendDash: {
          width: 14,
          height: 0,
          borderTopWidth: 2,
          borderStyle: 'dashed',
          marginRight: 5,
        },
        legendLabel: {
          fontSize: 11,
          color: colors.textSecondary,
        },
        warningBar: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 7,
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        warningText: {
          flex: 1,
          marginLeft: 7,
          fontSize: 11.5,
          color: colors.textSecondary,
        },
        controls: {
          position: 'absolute',
          right: 14,
          bottom: 18,
        },
        controlButton: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 9,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          outlineWidth: 0,
        },
      }),
    [colors],
  );

  if (loading) {
    return <ScreenLoading message={t('loading_graph_data')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (layout.nodes.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="git-network-outline" size={54} color={colors.textSecondary} />
          <Text style={styles.emptyText}>{t('story_map_empty')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {!!selectedStory?.title && (
          <Text style={styles.headerTitle} numberOfLines={1}>
            {selectedStory.title}
          </Text>
        )}
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {mapSubtitle}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.legendBar}
          contentContainerStyle={styles.legendContent}
        >
          {layout.chapters.map((chapter) => (
            <View key={chapter.id} style={styles.legendChip}>
              <View style={[styles.legendSwatch, { backgroundColor: chapter.color }]} />
              <Text style={styles.legendLabel}>{`${chapter.name} (${chapter.sceneCount})`}</Text>
            </View>
          ))}
          <View style={styles.legendChip}>
            <View style={[styles.legendOutline, { borderColor: colors.accent }]} />
            <Text style={styles.legendLabel}>{t('story_map_badge_start')}</Text>
          </View>
          <View style={styles.legendChip}>
            <View style={[styles.legendOutline, { borderColor: colors.error }]} />
            <Text style={styles.legendLabel}>{t('story_map_badge_finish')}</Text>
          </View>
          {layout.hasBackwardEdges && (
            <View style={styles.legendChip}>
              <View style={[styles.legendDash, { borderTopColor: colors.textSecondary }]} />
              <Text style={styles.legendLabel}>{t('story_map_legend_loops')}</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {layout.danglingChoiceCount > 0 && (
        <View style={styles.warningBar}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
          <Text style={styles.warningText}>
            {t('story_map_dangling_choices', { count: layout.danglingChoiceCount })}
          </Text>
        </View>
      )}

      <StoryGraphCanvas
        ref={canvasRef}
        layout={layout}
        showEdgeLabels={showEdgeLabels}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectNode}
      />

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => canvasRef.current?.zoomBy(1.25)}
          accessibilityLabel={t('story_map_zoom_in')}
        >
          <Ionicons name="add" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => canvasRef.current?.zoomBy(0.8)}
          accessibilityLabel={t('story_map_zoom_out')}
        >
          <Ionicons name="remove" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => canvasRef.current?.fitToScreen()}
          accessibilityLabel={t('story_map_fit')}
        >
          <Ionicons name="scan-outline" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setLabelsOverride(!showEdgeLabels)}
          accessibilityLabel={t('story_map_toggle_labels')}
        >
          <Ionicons
            name={showEdgeLabels ? 'chatbox' : 'chatbox-outline'}
            size={19}
            color={showEdgeLabels ? colors.primary : colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleExport}
          disabled={exporting}
          accessibilityLabel={t('story_map_export')}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="image-outline" size={20} color={colors.text} />
          )}
        </TouchableOpacity>
      </View>

      {selectedNode && (
        <GraphNodeSheet
          title={selectedNode.scene.name}
          subtitle={
            selectedNode.chapterName
              ? { text: selectedNode.chapterName, color: selectedNode.chapterColor }
              : undefined
          }
          badges={[
            ...(selectedNode.isStart
              ? [{ label: t('story_map_badge_start'), color: colors.accent }]
              : []),
            ...(selectedNode.isFinish
              ? [{ label: t('story_map_badge_finish'), color: colors.error }]
              : []),
            ...(selectedNode.isDetached
              ? [{ label: t('story_map_badge_detached'), color: colors.textSecondary }]
              : []),
          ]}
          sections={[
            ...(selectedNode.scene.summary
              ? [{ title: t('summary'), description: selectedNode.scene.summary }]
              : []),
            ...(hasSceneGap(selectedNode.scene) || hasSceneUniverseDuration(selectedNode.scene)
              ? [
                  {
                    title: t('scene_timing'),
                    description: [
                      hasSceneGap(selectedNode.scene)
                        ? `${t('gap')}: ${formatSceneGap(selectedNode.scene, t, selectedStory?.normalizeSceneTiming)}`
                        : null,
                      hasSceneUniverseDuration(selectedNode.scene)
                        ? `${t('in_universe_duration')}: ${formatSceneUniverseDuration(selectedNode.scene, t, selectedStory?.normalizeSceneTiming)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join('\n'),
                  },
                ]
              : []),
            ...(selectedSceneEffects.length > 0
              ? [
                  {
                    title: t('effects_title'),
                    description: selectedSceneEffects
                      .map((effect) => `• ${describeEffect(effect, itemNamesById, t)}`)
                      .join('\n'),
                  },
                ]
              : []),
            {
              title: t('story_map_outgoing_choices'),
              emptyMessage: t('story_map_no_outgoing_choices'),
              items: connections.outgoing.map((connection) => ({
                id: connection.choiceId,
                icon: 'arrow-forward' as const,
                label: connection.text || t('story_map_implicit_choice'),
                detail: connection.sceneName,
                extra: connection.extra,
                italicLabel: !connection.text,
                onPress: () => setSelectedNodeId(connection.sceneId),
              })),
            },
            {
              title: t('story_map_incoming_choices'),
              emptyMessage: t('story_map_no_incoming_choices'),
              items: connections.incoming.map((connection) => ({
                id: connection.choiceId,
                icon: 'arrow-back' as const,
                label: connection.text || t('story_map_implicit_choice'),
                detail: connection.sceneName,
                extra: connection.extra,
                italicLabel: !connection.text,
                onPress: () => setSelectedNodeId(connection.sceneId),
              })),
            },
          ]}
          actionLabel={t('story_map_open_scene')}
          onAction={() => handleOpenScene(selectedNode.id)}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </View>
  );
};

export default ChoiceViewScreen;
