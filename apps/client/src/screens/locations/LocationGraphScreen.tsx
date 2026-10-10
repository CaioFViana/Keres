import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { commonScreenStyleDefs, commonDetailStyleDefs } from '../../theme/commonStyles';
import { useNavigation } from '@react-navigation/native';
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
import GraphCanvasControls from '@/src/components/features/graphs/GraphCanvasControls/GraphCanvasControls';
import { graphMapHeaderStyleDefs } from '@/src/components/features/graphs/graphMapHeaderStyles';
import type { LocationGraphCanvasHandle } from '@/src/components/features/graphs/LocationGraph/LocationGraphCanvas';
import LocationGraphCanvas from '@/src/components/features/graphs/LocationGraph/LocationGraphCanvas';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useDrizzle } from '../../db';
import type { LocationRelationSelect, LocationSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { createLocationService } from '../../services/storymanagement/LocationService';
import { createLocationRelationService } from '../../services/storymanagement/LocationRelationService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';
import type {
  GraphLocationRelation,
  LocationGraphNode,
  LocationRelationKind,
} from '@keres/shared/graphs/locationGraphLayout';
import { buildLocationGraphLayout } from '@keres/shared/graphs/locationGraphLayout';
import { renderLocationGraphMapSvg } from '@keres/shared/graphs/locationGraphSvg';
import { filterLocationGraph } from '@keres/shared/graphs/locationGraphFilter';
import { buildLocationGraphMapFileName } from '../../utils/storyTransfer';
import type { LocationsScreenNavigationProp } from './LocationListScreen';
import { useGraphMapExport } from '@/src/hooks/useGraphMapExport';

/**
 * The Locations structure graph: each Location becomes a node, `contains`/`connected_to` become
 * edges. It mirrors `CharacterRelationGraphScreen` in experience (pan/zoom, a detail panel
 * on tapping a node), but with a tree layout (`locationGraphLayout`) instead of a radial one, because
 * `contains` is hierarchical and `connected_to` is not.
 *
 * Visualization/navigation only at this stage - no visual editing (dragging to reparent, etc.).
 */

/** Cap on the focus filter - the same ceiling as the character relation map. */
const MAX_SELECTED_LOCATIONS = 12;

interface LocationNodeConnection {
  relationId: string;
  locationId: string;
  locationName: string;
}

const LocationGraphScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();
  const { colors } = useTheme();
  const navigation = useNavigation<LocationsScreenNavigationProp>();
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();
  const { isCompact } = useResponsiveLayout();

  const canvasRef = useRef<LocationGraphCanvasHandle>(null);

  const [locations, setLocations] = useState<LocationSelect[]>([]);
  const [relations, setRelations] = useState<LocationRelationSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  /** Empty means the whole map; the focus filter only narrows it. */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const storyId = selectedStory?.id;

  const loadGraph = useCallback(async () => {
    if (!storyId) return;
    try {
      setLoading(true);
      setError(null);
      const [loadedLocations, loadedRelations] = await Promise.all([
        createLocationService(drizzleDb).getAllByStoryId(storyId),
        createLocationRelationService(drizzleDb).getAllRelationsForStory(storyId),
      ]);
      setLocations(loadedLocations);
      setRelations(loadedRelations);
    } catch (loadError) {
      console.log('LocationGraphScreen: failed to load graph data.', loadError);
      setError(t('failed_to_load_graph_data'));
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, storyId, t]);

  useGraphStoryReload(storyId, loadGraph);

  useScreenHeader({
    target: 'parent',
    title: t('location_graph_title'),
  });

  const graphRelations = useMemo(
    (): GraphLocationRelation[] =>
      relations
        .filter((r) => !r.isDeleted)
        .map((r) => ({ ...r, relationType: r.relationType as LocationRelationKind })),
    [relations],
  );

  const filtered = useMemo(
    () => filterLocationGraph(locations, graphRelations, selectedIds),
    [locations, graphRelations, selectedIds],
  );

  const layout = useMemo(
    () =>
      buildLocationGraphLayout(
        filtered.locations,
        filtered.relations,
        isCompact ? 'top-to-bottom' : 'left-to-right',
      ),
    [filtered, isCompact],
  );

  const selectedNode = useMemo(
    () => layout.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [layout.nodes, selectedNodeId],
  );

  const nameById = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node.location.name])),
    [layout.nodes],
  );

  const selectedParent = useMemo((): LocationNodeConnection | null => {
    if (!selectedNodeId) return null;
    const parentEdge = layout.edges.find(
      (edge) => edge.relationType === 'contains' && edge.targetId === selectedNodeId,
    );
    if (!parentEdge) return null;
    return {
      relationId: parentEdge.id,
      locationId: parentEdge.sourceId,
      locationName: nameById.get(parentEdge.sourceId) ?? t('unknown_location'),
    };
  }, [layout.edges, selectedNodeId, nameById, t]);

  const selectedChildren = useMemo((): LocationNodeConnection[] => {
    if (!selectedNodeId) return [];
    return layout.edges
      .filter((edge) => edge.relationType === 'contains' && edge.sourceId === selectedNodeId)
      .map((edge) => ({
        relationId: edge.id,
        locationId: edge.targetId,
        locationName: nameById.get(edge.targetId) ?? t('unknown_location'),
      }));
  }, [layout.edges, selectedNodeId, nameById, t]);

  const selectedConnections = useMemo((): LocationNodeConnection[] => {
    if (!selectedNodeId) return [];
    return layout.edges
      .filter(
        (edge) =>
          edge.relationType === 'connected_to' &&
          (edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId),
      )
      .map((edge) => {
        const otherId = edge.sourceId === selectedNodeId ? edge.targetId : edge.sourceId;
        return {
          relationId: edge.id,
          locationId: otherId,
          locationName: nameById.get(otherId) ?? t('unknown_location'),
        };
      });
  }, [layout.edges, selectedNodeId, nameById, t]);

  const handleSelectNode = useCallback((node: LocationGraphNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleOpenLocation = useCallback(
    (locationId: string) => {
      setSelectedNodeId(null);
      navigation.navigate('LocationDetail', { locationId });
    },
    [navigation],
  );

  const graphSubtitle = useMemo(
    () =>
      t('location_graph_subtitle', {
        locationCount: layout.nodes.length,
        relationCount: layout.edges.length,
        isolatedCount: layout.isolatedCount,
      }),
    [layout.edges.length, layout.isolatedCount, layout.nodes.length, t],
  );

  const { exporting, handleExport } = useGraphMapExport({
    story: selectedStory,
    hasNodes: layout.nodes.length > 0,
    renderSvg: (title) =>
      renderLocationGraphMapSvg(layout, {
        title,
        subtitle: graphSubtitle,
        highlightedNodeIds: selectedIds,
        labels: {
          isolated: t('location_graph_badge_isolated'),
          contains: t('location_relation_type_contains'),
          connectedTo: t('location_relation_type_connected_to'),
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
    buildFileName: buildLocationGraphMapFileName,
    messageKeys: {
      success: 'location_graph_export_success',
      noShareTarget: 'location_graph_export_no_share_target',
      failed: 'location_graph_export_failed',
    },
    logMessage: 'LocationGraphScreen: failed to export location graph.',
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
      <GraphEmptyState colors={colors} icon="map-outline" message={t('location_graph_empty')} />
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
          {graphSubtitle}
        </Text>
      </View>

      <MultiSelectPill
        options={locations.map((location) => ({
          label: location.name,
          value: location.id,
        }))}
        selectedValues={selectedIds}
        onSelectionChange={(next) => setSelectedIds(next.slice(0, MAX_SELECTED_LOCATIONS))}
        maxSelections={MAX_SELECTED_LOCATIONS}
        placeholder={term('Location', true)}
        searchPlaceholder={t('search')}
        triggerStyle={{ marginHorizontal: 8, marginTop: 10, minHeight: 42, paddingVertical: 5 }}
      />
      {selectedIds.length > 0 && (
        <GraphFilterSummary
          colors={colors}
          hint={t('location_graph_filter_hint')}
          clearLabel={t('location_graph_clear_filter')}
          onClear={() => setSelectedIds([])}
        />
      )}

      <LocationGraphCanvas
        ref={canvasRef}
        layout={layout}
        selectedNodeId={selectedNodeId}
        highlightedNodeIds={selectedIds}
        onSelectNode={handleSelectNode}
      />

      <GraphCanvasControls
        variant="map"
        labels={{
          zoomIn: t('location_graph_zoom_in'),
          zoomOut: t('location_graph_zoom_out'),
          fit: t('location_graph_fit'),
        }}
        exportLabel={t('location_graph_export')}
        onZoomIn={() => canvasRef.current?.zoomBy(1.25)}
        onZoomOut={() => canvasRef.current?.zoomBy(0.8)}
        onFit={() => canvasRef.current?.fitToScreen()}
        exporting={exporting}
        onExport={handleExport}
      />

      {selectedNode && (
        <GraphNodeSheet
          title={selectedNode.location.name}
          badges={
            selectedNode.isIsolated
              ? [{ label: t('location_graph_badge_isolated'), color: colors.textSecondary }]
              : undefined
          }
          sections={[
            {
              title: t('parent_location'),
              emptyMessage: t('no_parent_location'),
              items: selectedParent
                ? [
                    {
                      id: selectedParent.relationId,
                      icon: 'arrow-up-outline',
                      label: selectedParent.locationName,
                      onPress: () => setSelectedNodeId(selectedParent.locationId),
                    },
                  ]
                : [],
            },
            {
              title: t('child_locations'),
              emptyMessage: t('no_child_locations'),
              items: selectedChildren.map((connection) => ({
                id: connection.relationId,
                icon: 'arrow-down-outline' as const,
                label: connection.locationName,
                onPress: () => setSelectedNodeId(connection.locationId),
              })),
            },
            {
              title: t('connected_locations'),
              emptyMessage: t('no_connected_locations'),
              items: selectedConnections.map((connection) => ({
                id: connection.relationId,
                icon: 'git-network-outline' as const,
                label: connection.locationName,
                onPress: () => setSelectedNodeId(connection.locationId),
              })),
            },
          ]}
          actionLabel={t('location_graph_open_location')}
          onAction={() => handleOpenLocation(selectedNode.id)}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </View>
  );
};

export default LocationGraphScreen;
