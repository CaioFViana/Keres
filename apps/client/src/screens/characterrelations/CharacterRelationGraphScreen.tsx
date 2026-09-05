import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { commonScreenStyleDefs, commonDetailStyleDefs } from '../../theme/commonStyles';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import GraphNodeSheet from '@/src/components/features/graphs/GraphNodeSheet/GraphNodeSheet';
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
import { buildCharacterRelationMapFileName, deliverSvgMap } from '../../utils/storyTransfer';
import { entityEventEmitter } from '../../utils/EventEmitter';
import type { CharactersScreenNavigationProp } from '../../navigation/navigationProps';

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
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();
  const { colors } = useTheme();
  const navigation = useNavigation<CharactersScreenNavigationProp>();
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

  // Reloads on focus: characters and relations may have changed on another screen.
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
      navigation.navigate('CharactersStack', {
        screen: 'CharacterDetail',
        params: { characterId },
      });
    },
    [navigation],
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

      const result = await deliverSvgMap(
        svg,
        buildCharacterRelationMapFileName(selectedStory.title),
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
  ]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        ...commonScreenStyleDefs(colors),
        ...commonDetailStyleDefs(colors),
        header: {
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          paddingVertical: 9,
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
        filterActions: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingBottom: 8,
        },
        filterHint: {
          color: colors.textSecondary,
          fontSize: 12,
          flex: 1,
        },
        filterAction: { paddingVertical: 5 },
        filterActionText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
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
          <Ionicons name="people-outline" size={54} color={colors.textSecondary} />
          <Text style={styles.emptyText}>{t('character_relation_map_empty')}</Text>
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
        <View style={styles.filterActions}>
          <Text style={styles.filterHint}>{t('character_relation_map_filter_hint')}</Text>
          <TouchableOpacity style={styles.filterAction} onPress={() => setSelectedIds([])}>
            <Text style={styles.filterActionText}>{t('character_relation_map_clear_filter')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <CharacterRelationGraphCanvas
        ref={canvasRef}
        layout={layout}
        showEdgeLabels={showEdgeLabels}
        selectedNodeId={selectedNodeId}
        highlightedNodeIds={selectedIds}
        onSelectNode={handleSelectNode}
      />

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => canvasRef.current?.zoomBy(1.25)}
          accessibilityLabel={t('character_relation_map_zoom_in')}
        >
          <Ionicons name="add" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => canvasRef.current?.zoomBy(0.8)}
          accessibilityLabel={t('character_relation_map_zoom_out')}
        >
          <Ionicons name="remove" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => canvasRef.current?.fitToScreen()}
          accessibilityLabel={t('character_relation_map_fit')}
        >
          <Ionicons name="scan-outline" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setLabelsOverride(!showEdgeLabels)}
          accessibilityLabel={t('character_relation_map_toggle_labels')}
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
          accessibilityLabel={t('character_relation_map_export')}
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
