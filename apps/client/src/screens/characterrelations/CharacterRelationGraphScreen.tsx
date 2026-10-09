import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { commonScreenStyleDefs, commonDetailStyleDefs } from '../../theme/commonStyles';
import { useNavigation } from '@react-navigation/native';
import { useNavigateAcrossStacks } from '@/src/hooks/useNavigateAcrossStacks';
import { useGraphStoryReload } from '@/src/hooks/useGraphStoryReload';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import GraphNodeSheet from '@/src/components/features/graphs/GraphNodeSheet/GraphNodeSheet';
import GraphEmptyState from '@/src/components/features/graphs/GraphEmptyState/GraphEmptyState';
import GraphFilterSummary from '@/src/components/features/graphs/GraphFilterSummary/GraphFilterSummary';
import GraphMapControls from '@/src/components/features/graphs/GraphMapControls/GraphMapControls';
import { graphMapHeaderStyleDefs } from '@/src/components/features/graphs/graphMapHeaderStyles';
import type { CharacterRelationGraphCanvasHandle } from '@/src/components/features/graphs/CharacterRelationGraph/CharacterRelationGraphCanvas';
import CharacterRelationGraphCanvas from '@/src/components/features/graphs/CharacterRelationGraph/CharacterRelationGraphCanvas';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useDrizzle } from '../../db';
import type { CharacterSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { createCharacterService } from '../../services/storymanagement/CharacterService';
import type { CharacterRelationWithNames } from '../../services/storymanagement/CharacterRelationService';
import { createCharacterRelationService } from '../../services/storymanagement/CharacterRelationService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';
import type { RelationGraphNode } from '@keres/shared/graphs/characterRelationGraphLayout';
import { buildCharacterRelationGraphLayout } from '@keres/shared/graphs/characterRelationGraphLayout';
import { renderCharacterRelationMapSvg } from '@keres/shared/graphs/characterRelationGraphSvg';
import { filterCharacterRelationGraph } from '@keres/shared/graphs/characterRelationGraphFilter';
import {
  buildCharacterRelationMapFileName,
  deliverMapExport,
  exportFileLanguage,
} from '../../utils/storyTransfer';
import type { CharactersScreenNavigationProp } from '../../navigation/navigationProps';
import { chooseExportFormat } from '../../utils/exportFormatPrompt';

/**
 * The relations map: a story's characters and who knows whom.
 *
 * It mirrors the story map (`ChoiceViewScreen`) in experience - a detail panel on
 * tapping a node, pan/zoom, labels that hide themselves when the graph grows - but the
 * underlying layout is another one (`characterRelationGraphLayout`), because a relation between characters
 * has neither direction nor a "start": see `characterRelationGraphLayout.ts` for why.
 */

/** Above that the relation type on each edge pollutes more than it informs; the person can turn it back on. */
const EDGE_LABEL_AUTO_LIMIT = 40;

/** Cap on the focus filter - the same ceiling as the presence matrix series. */
const MAX_SELECTED_CHARACTERS = 12;

interface CharacterRelationNodeConnection {
  relationId: string;
  relationType: string;
  characterId: string;
  characterName: string;
}

const CharacterRelationGraphScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t, i18n } = useTranslation();
  const { term } = useStoryVocabulary();
  const { colors } = useTheme();
  const navigation = useNavigation<CharactersScreenNavigationProp>();
  const navigateAcross = useNavigateAcrossStacks();
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();
  const { showNotification } = useNotificationStore();
  const { isCompact } = useResponsiveLayout();

  const canvasRef = useRef<CharacterRelationGraphCanvasHandle>(null);

  const [characters, setCharacters] = useState<CharacterSelect[]>([]);
  const [relations, setRelations] = useState<CharacterRelationWithNames[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [labelsOverride, setLabelsOverride] = useState<boolean | null>(null);
  const [exporting, setExporting] = useState(false);
  /** Empty means the whole map; the focus filter only narrows it. */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const storyId = selectedStory?.id;

  const loadGraph = useCallback(async () => {
    if (!storyId) return;
    try {
      setLoading(true);
      setError(null);
      const [loadedCharacters, loadedRelations] = await Promise.all([
        createCharacterService(drizzleDb).getCharactersByStoryId(storyId),
        createCharacterRelationService(drizzleDb).getCharacterRelationsByStoryId(storyId),
      ]);
      setCharacters(loadedCharacters);
      setRelations(loadedRelations);
    } catch (loadError) {
      console.log('CharacterRelationGraphScreen: failed to load graph data.', loadError);
      setError(t('failed_to_load_graph_data'));
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, storyId, t]);

  useGraphStoryReload(storyId, loadGraph);

  useScreenHeader({
    target: 'parent',
    title: t('character_relation_map_title'),
  });

  const filtered = useMemo(
    () => filterCharacterRelationGraph(characters, relations, selectedIds),
    [characters, relations, selectedIds],
  );

  const layout = useMemo(
    () =>
      buildCharacterRelationGraphLayout(
        filtered.characters,
        filtered.relations,
        isCompact ? 'top-to-bottom' : 'left-to-right',
      ),
    [filtered, isCompact],
  );

  const showEdgeLabels = labelsOverride ?? layout.edges.length <= EDGE_LABEL_AUTO_LIMIT;

  const selectedNode = useMemo(
    () => layout.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [layout.nodes, selectedNodeId],
  );

  const connections = useMemo((): CharacterRelationNodeConnection[] => {
    if (!selectedNodeId) return [];
    const nameById = new Map(layout.nodes.map((node) => [node.id, node.character.name]));

    return layout.edges
      .filter((edge) => edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId)
      .map((edge) => {
        const otherId = edge.sourceId === selectedNodeId ? edge.targetId : edge.sourceId;
        return {
          relationId: edge.id,
          relationType: edge.label,
          characterId: otherId,
          characterName: nameById.get(otherId) ?? t('unknown_entity'),
        };
      });
  }, [layout.edges, layout.nodes, selectedNodeId, t]);

  const handleSelectNode = useCallback((node: RelationGraphNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleOpenCharacter = useCallback(
    (characterId: string) => {
      setSelectedNodeId(null);
      navigateAcross('CharactersStack', 'CharacterDetail', { characterId });
    },
    [navigateAcross],
  );

  const mapSubtitle = useMemo(
    () =>
      t('character_relation_map_subtitle', {
        characterCount: layout.nodes.length,
        relationCount: layout.edges.length,
        isolatedCount: layout.isolatedCount,
      }),
    [layout.edges.length, layout.isolatedCount, layout.nodes.length, t],
  );

  const handleExport = useCallback(async () => {
    if (!selectedStory || layout.nodes.length === 0) return;

    const format = await chooseExportFormat();
    if (!format) return;
    setExporting(true);
    try {
      const svg = renderCharacterRelationMapSvg(layout, {
        title: selectedStory.title,
        subtitle: mapSubtitle,
        showEdgeLabels,
        highlightedNodeIds: selectedIds,
        labels: {
          isolated: t('character_relation_map_badge_isolated'),
        },
        colors: {
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
          primaryContainer: colors.primaryContainer,
          primary: colors.primary,
        },
      });

      const result = await deliverMapExport(
        svg,
        buildCharacterRelationMapFileName(
          selectedStory.title,
          new Date(),
          exportFileLanguage(i18n.language),
        ),
        format,
      );
      if (result.delivered) {
        showNotification(
          t('character_relation_map_export_success', { fileName: result.fileName }),
          'success',
        );
      } else {
        // With no share sheet the file exists, but the user has no way to reach it; saying where
        // it is is more useful than claiming success.
        showNotification(
          t('character_relation_map_export_no_share_target', {
            path: result.uri || result.fileName,
          }),
          'warning',
        );
      }
    } catch (exportError) {
      console.log('CharacterRelationGraphScreen: failed to export relation map.', exportError);
      showNotification(t('character_relation_map_export_failed'), 'error');
    } finally {
      setExporting(false);
    }
  }, [
    colors,
    layout,
    mapSubtitle,
    selectedIds,
    selectedStory,
    showEdgeLabels,
    showNotification,
    t,
    i18n,
  ]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        ...commonScreenStyleDefs(colors),
        ...commonDetailStyleDefs(colors),
        ...graphMapHeaderStyleDefs(colors),
        header: {
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          paddingVertical: 9,
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
      <GraphEmptyState
        colors={colors}
        icon="people-outline"
        message={t('character_relation_map_empty')}
      />
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
      </View>

      <MultiSelectPill
        options={characters.map((character) => ({
          label: character.name,
          value: character.id,
        }))}
        selectedValues={selectedIds}
        onSelectionChange={(next) => setSelectedIds(next.slice(0, MAX_SELECTED_CHARACTERS))}
        maxSelections={MAX_SELECTED_CHARACTERS}
        placeholder={term('Character', true)}
        searchPlaceholder={t('search')}
        triggerStyle={{ marginHorizontal: 8, marginTop: 10, minHeight: 42, paddingVertical: 5 }}
      />
      {selectedIds.length > 0 && (
        <GraphFilterSummary
          colors={colors}
          hint={t('character_relation_map_filter_hint')}
          clearLabel={t('character_relation_map_clear_filter')}
          onClear={() => setSelectedIds([])}
        />
      )}

      <CharacterRelationGraphCanvas
        ref={canvasRef}
        layout={layout}
        showEdgeLabels={showEdgeLabels}
        selectedNodeId={selectedNodeId}
        highlightedNodeIds={selectedIds}
        onSelectNode={handleSelectNode}
      />

      <GraphMapControls
        colors={colors}
        labels={{
          zoomIn: t('character_relation_map_zoom_in'),
          zoomOut: t('character_relation_map_zoom_out'),
          fit: t('character_relation_map_fit'),
          export: t('character_relation_map_export'),
        }}
        onZoomIn={() => canvasRef.current?.zoomBy(1.25)}
        onZoomOut={() => canvasRef.current?.zoomBy(0.8)}
        onFit={() => canvasRef.current?.fitToScreen()}
        edgeLabels={{
          visible: showEdgeLabels,
          label: t('character_relation_map_toggle_labels'),
          onToggle: () => setLabelsOverride(!showEdgeLabels),
        }}
        exporting={exporting}
        onExport={handleExport}
      />

      {selectedNode && (
        <GraphNodeSheet
          title={selectedNode.character.name}
          badges={
            selectedNode.isIsolated
              ? [{ label: t('character_relation_map_badge_isolated'), color: colors.textSecondary }]
              : undefined
          }
          sections={[
            {
              title: t('character_relation_map_relations_title'),
              emptyMessage: t('character_relation_map_no_relations'),
              items: connections.map((connection) => ({
                id: connection.relationId,
                icon: 'people-outline' as const,
                label: connection.characterName,
                detail: connection.relationType,
                onPress: () => setSelectedNodeId(connection.characterId),
              })),
            },
          ]}
          actionLabel={t('character_relation_map_open_character')}
          onAction={() => handleOpenCharacter(selectedNode.id)}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </View>
  );
};

export default CharacterRelationGraphScreen;
