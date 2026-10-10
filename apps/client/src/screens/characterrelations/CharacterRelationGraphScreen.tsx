import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { commonScreenStyleDefs, commonDetailStyleDefs } from '../../theme/commonStyles';
import { useNavigation } from '@react-navigation/native';
import { useNavigateAcrossStacks } from '@/src/hooks/useNavigateAcrossStacks';
import { useGraphDataLoader } from '@/src/hooks/useGraphDataLoader';
import { useGraphFocus } from '@/src/hooks/useGraphFocus';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import GraphLegend from '@/src/components/features/graphs/GraphLegend/GraphLegend';
import GraphNodeFinder from '@/src/components/features/graphs/GraphNodeFinder/GraphNodeFinder';
import GraphNodeSheet from '@/src/components/features/graphs/GraphNodeSheet/GraphNodeSheet';
import GraphEmptyState from '@/src/components/features/graphs/GraphEmptyState/GraphEmptyState';
import GraphFilterSummary from '@/src/components/features/graphs/GraphFilterSummary/GraphFilterSummary';
import GraphCanvasControls from '@/src/components/features/graphs/GraphCanvasControls/GraphCanvasControls';
import { graphMapHeaderStyleDefs } from '@/src/components/features/graphs/graphMapHeaderStyles';
import type { CharacterRelationGraphCanvasHandle } from '@/src/components/features/graphs/CharacterRelationGraph/CharacterRelationGraphCanvas';
import CharacterRelationGraphCanvas from '@/src/components/features/graphs/CharacterRelationGraph/CharacterRelationGraphCanvas';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import CharacterRelationModal from '@/src/components/features/relations/CharacterRelationManager/CharacterRelationModal';
import type { Character } from '@keres/shared/entities/Character';
import { useDrizzle } from '../../db';
import type { CharacterSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createCharacterService } from '../../services/storymanagement/CharacterService';
import type { CharacterRelationWithNames } from '../../services/storymanagement/CharacterRelationService';
import { createCharacterRelationService } from '../../services/storymanagement/CharacterRelationService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';
import type { RelationGraphEdge } from '@keres/shared/graphs/characterRelationGraphLayout';
import { limitFocusSelection, MAX_FOCUS_SELECTION } from '@keres/shared/graphs/graphNeighborhood';
import {
  assignRelationTypeColors,
  foldRelationType,
} from '@keres/shared/graphs/relationTypeColors';
import { buildCharacterRelationGraphLayout } from '@keres/shared/graphs/characterRelationGraphLayout';
import { renderCharacterRelationMapSvg } from '@keres/shared/graphs/characterRelationGraphSvg';
import { filterCharacterRelationGraph } from '@keres/shared/graphs/characterRelationGraphFilter';
import { buildCharacterRelationMapFileName } from '../../utils/storyTransfer';
import { useCharacterRelationEditor } from './useCharacterRelationEditor';
import type { CharactersScreenNavigationProp } from '../../navigation/navigationProps';
import { useGraphMapExport } from '@/src/hooks/useGraphMapExport';

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

const relationEnds = (edge: RelationGraphEdge) => [edge.sourceId, edge.targetId] as const;

const NO_CHARACTERS: CharacterSelect[] = [];
const NO_RELATIONS: CharacterRelationWithNames[] = [];

interface CharacterRelationNodeConnection {
  relationId: string;
  relationType: string;
  characterId: string;
  characterName: string;
}

const CharacterRelationGraphScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation<CharactersScreenNavigationProp>();
  const navigateAcross = useNavigateAcrossStacks();
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();
  const { isCompact } = useResponsiveLayout();

  const canvasRef = useRef<CharacterRelationGraphCanvasHandle>(null);

  const [labelsOverride, setLabelsOverride] = useState<boolean | null>(null);
  /** Empty means the whole map; the focus filter only narrows it. */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** Kinds of relation the author switched off in the legend (folded). */
  const [hiddenTypes, setHiddenTypes] = useState<string[]>([]);

  const storyId = selectedStory?.id;
  const { userId } = useUserSettingsStore();
  const { canEdit } = useStoryRole(storyId);

  const loadGraphData = useCallback(
    async (id: string) => {
      const [loadedCharacters, loadedRelations] = await Promise.all([
        createCharacterService(drizzleDb).getCharactersByStoryId(id),
        createCharacterRelationService(drizzleDb).getCharacterRelationsByStoryId(id),
      ]);
      return { characters: loadedCharacters, relations: loadedRelations };
    },
    [drizzleDb],
  );
  const {
    data: loaded,
    loading,
    error,
    reload,
  } = useGraphDataLoader({
    storyId,
    load: loadGraphData,
    errorMessage: t('failed_to_load_graph_data'),
    logMessage: 'CharacterRelationGraphScreen: failed to load graph data.',
  });
  const characters = loaded?.characters ?? NO_CHARACTERS;
  const relations = loaded?.relations ?? NO_RELATIONS;

  useScreenHeader({
    target: 'parent',
    title: t('character_relation_map_title'),
  });

  // The colours come from every relation, not the visible ones, so a kind keeps its colour while
  // the author switches others off.
  const typeColors = useMemo(
    () =>
      assignRelationTypeColors(
        relations.map((relation) => relation.relationType),
        isDarkMode ? 'dark' : 'light',
      ),
    [isDarkMode, relations],
  );

  const legendItems = useMemo(() => {
    const kinds = new Map<string, { label: string; count: number }>();
    for (const relation of relations) {
      const key = foldRelationType(relation.relationType);
      if (!key) continue;
      const kind = kinds.get(key);
      if (kind) kind.count += 1;
      else kinds.set(key, { label: relation.relationType.trim(), count: 1 });
    }
    return [...kinds.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .map(([key, kind]) => ({
        id: key,
        label: `${kind.label} (${kind.count})`,
        color: typeColors.get(key) ?? colors.border,
        hidden: hiddenTypes.includes(key),
        onToggle: () =>
          setHiddenTypes((current) =>
            current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
          ),
      }));
  }, [colors.border, hiddenTypes, relations, typeColors]);

  const visibleRelations = useMemo(
    () =>
      hiddenTypes.length === 0
        ? relations
        : relations.filter(
            (relation) => !hiddenTypes.includes(foldRelationType(relation.relationType)),
          ),
    [hiddenTypes, relations],
  );

  // A character whose only relations are of a kind switched off leaves the map with them, rather
  // than turning up as "no relations": it is not unrelated, only out of this view.
  const visibleCharacters = useMemo(() => {
    if (hiddenTypes.length === 0) return characters;
    const related = new Set(relations.flatMap((r) => [r.character1Id, r.character2Id]));
    const stillRelated = new Set(visibleRelations.flatMap((r) => [r.character1Id, r.character2Id]));
    return characters.filter((c) => !related.has(c.id) || stillRelated.has(c.id));
  }, [characters, hiddenTypes.length, relations, visibleRelations]);

  const filtered = useMemo(
    () => filterCharacterRelationGraph(visibleCharacters, visibleRelations, selectedIds),
    [visibleCharacters, visibleRelations, selectedIds],
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

  const focus = useGraphFocus({
    nodes: layout.nodes,
    edges: layout.edges,
    ends: relationEnds,
    canvasRef,
    filterKey: selectedIds.join(','),
    clearFilter: () => setSelectedIds([]),
  });
  const { selectedNode, selectedNodeId, closeDetails } = focus;

  const editor = useCharacterRelationEditor({
    db: drizzleDb,
    storyId,
    userId,
    relations,
    reload,
  });

  // A big map writes no relation type until one character is in focus: then its own are written.
  const showEdgeLabels =
    labelsOverride ?? (layout.edges.length <= EDGE_LABEL_AUTO_LIMIT || !!selectedNode);

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

  const handleOpenCharacter = useCallback(
    (characterId: string) => {
      closeDetails();
      navigateAcross('CharactersStack', 'CharacterDetail', { characterId });
    },
    [closeDetails, navigateAcross],
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

  const { exporting, handleExport } = useGraphMapExport({
    story: selectedStory,
    hasNodes: layout.nodes.length > 0,
    renderSvg: (title) =>
      renderCharacterRelationMapSvg(layout, {
        title,
        subtitle: mapSubtitle,
        showEdgeLabels,
        highlightedNodeIds: selectedIds,
        relationTypeColors: typeColors,
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
      }),
    buildFileName: buildCharacterRelationMapFileName,
    messageKeys: {
      success: 'character_relation_map_export_success',
      noShareTarget: 'character_relation_map_export_no_share_target',
      failed: 'character_relation_map_export_failed',
    },
    logMessage: 'CharacterRelationGraphScreen: failed to export relation map.',
  });

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
          paddingVertical: 10,
        },
        noRelationsHint: {
          color: colors.textSecondary,
          fontSize: 12,
          paddingHorizontal: 12,
          paddingBottom: 6,
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
        hint={t('character_relation_map_empty_hint')}
        actionLabel={t('character_relation_map_empty_action')}
        onAction={() =>
          navigateAcross('CharactersStack', 'CharacterForm', { characterId: undefined })
        }
      />
    );
  }

  const filterHint =
    selectedIds.length >= MAX_FOCUS_SELECTION
      ? `${t('character_relation_map_filter_hint')} ${t('graph_focus_limit_hint', { count: MAX_FOCUS_SELECTION })}`
      : t('character_relation_map_filter_hint');

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

      <GraphNodeFinder
        options={characters.map((character) => ({ id: character.id, label: character.name }))}
        placeholder={t('character_relation_map_find')}
        onPick={focus.goToNode}
      />

      <MultiSelectPill
        options={characters.map((character) => ({
          label: character.name,
          value: character.id,
        }))}
        selectedValues={selectedIds}
        onSelectionChange={(next) => setSelectedIds(limitFocusSelection(next).ids)}
        maxSelections={MAX_FOCUS_SELECTION}
        placeholder={term('Character', true)}
        searchPlaceholder={t('search')}
        triggerStyle={{ marginHorizontal: 8, marginTop: 10, minHeight: 42, paddingVertical: 5 }}
      />
      {selectedIds.length > 0 && (
        <GraphFilterSummary
          colors={colors}
          hint={filterHint}
          clearLabel={t('character_relation_map_clear_filter')}
          onClear={() => setSelectedIds([])}
        />
      )}
      {relations.length === 0 && (
        <Text style={styles.noRelationsHint}>{t('character_relation_map_none_yet')}</Text>
      )}

      <CharacterRelationGraphCanvas
        ref={canvasRef}
        label={t('character_relation_map_title')}
        layout={layout}
        showEdgeLabels={showEdgeLabels}
        selectedNodeId={selectedNodeId}
        highlightedNodeIds={selectedIds}
        focusNodeIds={focus.focusNodeIds}
        edgeColors={typeColors}
        nodeAccessibilityLabel={(node) =>
          t('graph_node_a11y', { name: node.character.name, count: node.degree })
        }
        onSelectNode={(node) => focus.tapNode(node.id)}
        onBackgroundTap={focus.clearFocus}
      />

      <GraphLegend title={t('graph_legend_title')} items={legendItems} />

      <GraphCanvasControls
        variant="map"
        labels={{
          zoomIn: t('character_relation_map_zoom_in'),
          zoomOut: t('character_relation_map_zoom_out'),
          fit: t('character_relation_map_fit'),
          center: t('center_on_selection'),
        }}
        exportLabel={t('character_relation_map_export')}
        onZoomIn={() => canvasRef.current?.zoomBy(1.25)}
        onZoomOut={() => canvasRef.current?.zoomBy(0.8)}
        onFit={() => canvasRef.current?.fitToScreen()}
        onCenterSelection={selectedNode ? focus.centerSelection : undefined}
        edgeLabels={{
          visible: showEdgeLabels,
          label: t('character_relation_map_toggle_labels'),
          onToggle: () => setLabelsOverride(!showEdgeLabels),
        }}
        exporting={exporting}
        onExport={handleExport}
      />

      {selectedNode && focus.detailsOpen && (
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
                onPress: () => focus.selectNode(connection.characterId),
                trailing: canEdit
                  ? [
                      {
                        icon: 'pencil' as const,
                        label: `${t('edit')}: ${connection.characterName}`,
                        onPress: () => {
                          closeDetails();
                          editor.openEdit(selectedNode.id, connection.relationId);
                        },
                      },
                      {
                        icon: 'trash-outline' as const,
                        label: `${t('delete')}: ${connection.characterName}`,
                        destructive: true,
                        onPress: () => editor.remove(selectedNode.id, connection.relationId),
                      },
                    ]
                  : undefined,
              })),
              actions: canEdit
                ? [
                    {
                      label: t('add_character_relation'),
                      onPress: () => {
                        closeDetails();
                        editor.openAdd(selectedNode.id);
                      },
                    },
                  ]
                : undefined,
            },
          ]}
          actionLabel={t('character_relation_map_open_character')}
          onAction={() => handleOpenCharacter(selectedNode.id)}
          onClose={closeDetails}
        />
      )}

      {editor.target && (
        <CharacterRelationModal
          isVisible
          onClose={editor.close}
          onSave={(relatedId, relationType, relationId) =>
            void editor.save(relatedId, relationType, relationId)
          }
          initialRelation={editor.editing}
          characters={characters as unknown as Character[]}
          currentStoryId={storyId ?? ''}
          currentCharacterId={editor.target.characterId}
          relatedCharacterIds={editor.relatedCharacterIds}
        />
      )}
    </View>
  );
};

export default CharacterRelationGraphScreen;
