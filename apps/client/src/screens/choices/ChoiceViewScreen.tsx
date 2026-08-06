import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import SceneNodeSheet, { SceneNodeConnection } from '../../components/StoryGraph/SceneNodeSheet';
import StoryGraphCanvas, { StoryGraphCanvasHandle } from '../../components/StoryGraph/StoryGraphCanvas';
import { useDrizzle } from '../../db';
import { ChapterSelect, ChoiceSelect, SceneSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { createChapterService } from '../../services/storymanagement/ChapterService';
import { createChoiceService } from '../../services/storymanagement/ChoiceService';
import { createSceneService } from '../../services/storymanagement/SceneService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';
import { buildStoryGraphLayout, GraphEdge, GraphNode } from '../../utils/storyGraphLayout';
import { renderStoryMapSvg } from '../../utils/storyGraphSvg';
import { buildStoryMapFileName, deliverSvgMap } from '../../utils/storyTransfer';
import { ChoicesScreenNavigationProp } from './ChoiceListScreen';

/**
 * Mapa da história: as cenas e as escolhas que ligam uma à outra.
 *
 * Substitui a tentativa anterior em WebView + Cytoscape, que carregava a biblioteca de uma CDN
 * (ou seja, não funcionava offline, num app cujo ponto é funcionar offline) e usava um layout
 * de força que empilhava os nós um sobre o outro. Aqui o posicionamento é calculado em
 * `storyGraphLayout` e desenhado nativamente, então o mapa é o mesmo em toda abertura, sai
 * legível e pode ser exportado inteiro como imagem.
 */

/** Acima disso o texto das escolhas polui mais do que informa; o usuário pode reativar. */
const EDGE_LABEL_AUTO_LIMIT = 40;

const ChoiceViewScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ChoicesScreenNavigationProp>();
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();
  const { showNotification } = useNotificationStore();

  const canvasRef = useRef<StoryGraphCanvasHandle>(null);

  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [choices, setChoices] = useState<ChoiceSelect[]>([]);
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
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
      const [loadedScenes, loadedChoices, loadedChapters] = await Promise.all([
        createSceneService(drizzleDb).getScenesByStoryId(storyId),
        createChoiceService(drizzleDb).getChoicesByStoryId(storyId),
        createChapterService(drizzleDb).getChaptersByStoryId(storyId),
      ]);
      setScenes(loadedScenes);
      setChoices(loadedChoices);
      setChapters(loadedChapters);
    } catch (loadError) {
      console.log('ChoiceViewScreen: failed to load graph data.', loadError);
      setError(t('failed_to_load_graph_data'));
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, storyId, t]);

  // Recarrega ao focar: cenas e escolhas podem ter mudado em outra tela.
  useFocusEffect(useCallback(() => {
    loadGraph();
  }, [loadGraph]));

  useFocusEffect(useCallback(() => {
    setDocumentTitle(t('story_map_title'));
    navigation.getParent()?.setOptions({ title: t('story_map_title'), headerRight: undefined });
  }, [navigation, t]));

  const layout = useMemo(
    () => buildStoryGraphLayout(scenes, choices, chapters),
    [scenes, choices, chapters]
  );

  const showEdgeLabels = labelsOverride ?? layout.edges.length <= EDGE_LABEL_AUTO_LIMIT;

  const selectedNode = useMemo(
    () => layout.nodes.find(node => node.id === selectedNodeId) ?? null,
    [layout.nodes, selectedNodeId]
  );

  const connections = useMemo(() => {
    if (!selectedNodeId) return { outgoing: [] as SceneNodeConnection[], incoming: [] as SceneNodeConnection[] };
    const nameById = new Map(layout.nodes.map(node => [node.id, node.scene.name]));

    const toConnection = (edge: GraphEdge, sceneId: string): SceneNodeConnection => ({
      choiceId: edge.id,
      text: edge.label.trim(),
      sceneId,
      sceneName: nameById.get(sceneId) ?? t('unknown_scene'),
    });

    return {
      outgoing: layout.edges
        .filter(edge => edge.sourceId === selectedNodeId)
        .map(edge => toConnection(edge, edge.targetId)),
      incoming: layout.edges
        .filter(edge => edge.targetId === selectedNodeId)
        .map(edge => toConnection(edge, edge.sourceId)),
    };
  }, [layout.edges, layout.nodes, selectedNodeId, t]);

  const handleSelectNode = useCallback((node: GraphNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleOpenScene = useCallback((sceneId: string) => {
    setSelectedNodeId(null);
    navigation.navigate('ScenesStack', { screen: 'SceneDetail', params: { sceneId } });
  }, [navigation]);

  // Mesma linha de contexto na tela e no arquivo exportado: o mapa impresso e o mapa aberto
  // no app precisam dizer a mesma coisa sobre o que está sendo mostrado.
  const mapSubtitle = useMemo(
    () => t('story_map_subtitle', {
      sceneCount: layout.nodes.length,
      choiceCount: layout.edges.length,
      date: new Date().toLocaleDateString(),
    }),
    [layout.edges.length, layout.nodes.length, t]
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
        // Sem share sheet o arquivo existe mas o usuário não tem como alcançá-lo; dizer onde
        // ele está é mais útil do que alegar sucesso.
        showNotification(t('story_map_export_no_share_target', { path: result.uri || result.fileName }), 'warning');
      }
    } catch (exportError) {
      console.log('ChoiceViewScreen: failed to export story map.', exportError);
      showNotification(t('story_map_export_failed'), 'error');
    } finally {
      setExporting(false);
    }
  }, [colors, layout, mapSubtitle, selectedStory, showEdgeLabels, showNotification, t]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
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
      // Sem isto o ScrollView horizontal estica na vertical e come metade da tela: dentro de
      // um container em coluna ele cresce no eixo cruzado por padrão.
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
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyText: {
      marginTop: 12,
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
    },
  }), [colors]);

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
          <Text style={styles.headerTitle} numberOfLines={1}>{selectedStory.title}</Text>
        )}
        <Text style={styles.headerSubtitle} numberOfLines={1}>{mapSubtitle}</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.legendBar}
          contentContainerStyle={styles.legendContent}
        >
          {layout.chapters.map(chapter => (
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
          {exporting
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="image-outline" size={20} color={colors.text} />}
        </TouchableOpacity>
      </View>

      <SceneNodeSheet
        node={selectedNode}
        outgoing={connections.outgoing}
        incoming={connections.incoming}
        onClose={() => setSelectedNodeId(null)}
        onOpenScene={handleOpenScene}
        onSelectScene={setSelectedNodeId}
      />
    </View>
  );
};

export default ChoiceViewScreen;
