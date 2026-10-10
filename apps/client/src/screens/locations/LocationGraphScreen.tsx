import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { commonScreenStyleDefs, commonDetailStyleDefs } from '../../theme/commonStyles';
import { useNavigation } from '@react-navigation/native';
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
import {
  degreeById,
  limitFocusSelection,
  MAX_FOCUS_SELECTION,
} from '@keres/shared/graphs/graphNeighborhood';
import type {
  GraphLocationRelation,
  LocationGraphEdge,
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

const locationEnds = (edge: LocationGraphEdge) => [edge.sourceId, edge.targetId] as const;

const NO_LOCATIONS: LocationSelect[] = [];
const NO_RELATIONS: LocationRelationSelect[] = [];

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

  /** Empty means the whole map; the focus filter only narrows it. */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const storyId = selectedStory?.id;

  const loadGraphData = useCallback(
    async (id: string) => {
      const [loadedLocations, loadedRelations] = await Promise.all([
        createLocationService(drizzleDb).getAllByStoryId(id),
        createLocationRelationService(drizzleDb).getAllRelationsForStory(id),
      ]);
      return { locations: loadedLocations, relations: loadedRelations };
    },
    [drizzleDb],
  );
  const {
    data: loaded,
    loading,
    error,
  } = useGraphDataLoader({
    storyId,
    load: loadGraphData,
    errorMessage: t('failed_to_load_graph_data'),
    logMessage: 'LocationGraphScreen: failed to load graph data.',
  });
  const locations = loaded?.locations ?? NO_LOCATIONS;
  const relations = loaded?.relations ?? NO_RELATIONS;

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

  const focus = useGraphFocus({
    nodes: layout.nodes,
    edges: layout.edges,
    ends: locationEnds,
    canvasRef,
    filterKey: selectedIds.join(','),
    clearFilter: () => setSelectedIds([]),
  });
  const { selectedNode, selectedNodeId, closeDetails } = focus;

  const degrees = useMemo(() => degreeById(layout.edges, locationEnds), [layout.edges]);

  /** Which kinds of line are on the map, so the legend only names what the author can see. */
  const legendItems = useMemo(
    () => [
      ...(layout.edges.some((edge) => edge.relationType === 'contains')
        ? [
            {
              id: 'contains',
              label: t('location_relation_type_contains'),
              color: colors.primary,
            },
          ]
        : []),
      ...(layout.edges.some((edge) => edge.relationType === 'connected_to')
        ? [
            {
              id: 'connected_to',
              label: t('location_relation_type_connected_to'),
              color: colors.textSecondary,
              dashed: true,
            },
          ]
        : []),
    ],
    [colors.primary, colors.textSecondary, layout.edges, t],
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

  const handleOpenLocation = useCallback(
    (locationId: string) => {
      closeDetails();
      navigation.navigate('LocationDetail', { locationId });
    },
    [closeDetails, navigation],
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
        icon="map-outline"
        message={t('location_graph_empty')}
        hint={t('location_graph_empty_hint')}
        actionLabel={t('location_graph_empty_action')}
        onAction={() => navigation.navigate('LocationForm', { locationId: undefined })}
      />
    );
  }

  const filterHint =
    selectedIds.length >= MAX_FOCUS_SELECTION
      ? `${t('location_graph_filter_hint')} ${t('graph_focus_limit_hint', { count: MAX_FOCUS_SELECTION })}`
      : t('location_graph_filter_hint');

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

      <GraphNodeFinder
        options={locations.map((location) => ({ id: location.id, label: location.name }))}
        placeholder={t('location_graph_find')}
        onPick={focus.goToNode}
      />

      <MultiSelectPill
        options={locations.map((location) => ({
          label: location.name,
          value: location.id,
        }))}
        selectedValues={selectedIds}
        onSelectionChange={(next) => setSelectedIds(limitFocusSelection(next).ids)}
        maxSelections={MAX_FOCUS_SELECTION}
        placeholder={term('Location', true)}
        searchPlaceholder={t('search')}
        triggerStyle={{ marginHorizontal: 8, marginTop: 10, minHeight: 42, paddingVertical: 5 }}
      />
      {selectedIds.length > 0 && (
        <GraphFilterSummary
          colors={colors}
          hint={filterHint}
          clearLabel={t('location_graph_clear_filter')}
          onClear={() => setSelectedIds([])}
        />
      )}
      {graphRelations.length === 0 && (
        <Text style={styles.noRelationsHint}>{t('location_graph_none_yet')}</Text>
      )}

      <LocationGraphCanvas
        ref={canvasRef}
        label={t('location_graph_title')}
        layout={layout}
        selectedNodeId={selectedNodeId}
        highlightedNodeIds={selectedIds}
        focusNodeIds={focus.focusNodeIds}
        nodeAccessibilityLabel={(node) =>
          t('graph_node_a11y', { name: node.location.name, count: degrees.get(node.id) ?? 0 })
        }
        onSelectNode={(node) => focus.tapNode(node.id)}
        onBackgroundTap={focus.clearFocus}
      />

      <GraphLegend title={t('graph_legend_title')} items={legendItems} />

      <GraphCanvasControls
        variant="map"
        labels={{
          zoomIn: t('location_graph_zoom_in'),
          zoomOut: t('location_graph_zoom_out'),
          fit: t('location_graph_fit'),
          center: t('center_on_selection'),
        }}
        exportLabel={t('location_graph_export')}
        onZoomIn={() => canvasRef.current?.zoomBy(1.25)}
        onZoomOut={() => canvasRef.current?.zoomBy(0.8)}
        onFit={() => canvasRef.current?.fitToScreen()}
        onCenterSelection={selectedNode ? focus.centerSelection : undefined}
        exporting={exporting}
        onExport={handleExport}
      />

      {selectedNode && focus.detailsOpen && (
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
                      onPress: () => focus.selectNode(selectedParent.locationId),
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
                onPress: () => focus.selectNode(connection.locationId),
              })),
            },
            {
              title: t('connected_locations'),
              emptyMessage: t('no_connected_locations'),
              items: selectedConnections.map((connection) => ({
                id: connection.relationId,
                icon: 'git-network-outline' as const,
                label: connection.locationName,
                onPress: () => focus.selectNode(connection.locationId),
              })),
            },
          ]}
          actionLabel={t('location_graph_open_location')}
          onAction={() => handleOpenLocation(selectedNode.id)}
          onClose={closeDetails}
        />
      )}
    </View>
  );
};

export default LocationGraphScreen;
