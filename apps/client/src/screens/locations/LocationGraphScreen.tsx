import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { commonScreenStyleDefs, commonDetailStyleDefs } from '../../theme/commonStyles';
import { useNavigation } from '@react-navigation/native';
import { useGraphDataLoader } from '@/src/hooks/useGraphDataLoader';
import { useGraphFocus } from '@/src/hooks/useGraphFocus';
import { useStoryRole } from '@/src/hooks/useStoryRole';
import LocationPickerModal from '@/src/components/features/relations/LocationRelationManager/LocationPickerModal';
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
import { useUserSettingsStore } from '../../state/userSettingsStore';
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
import { collapseLocationGraph } from '@keres/shared/graphs/locationGraphCollapse';
import { renderLocationGraphMapSvg } from '@keres/shared/graphs/locationGraphSvg';
import { filterLocationGraph } from '@keres/shared/graphs/locationGraphFilter';
import { buildLocationGraphMapFileName } from '../../utils/storyTransfer';
import type { LocationsScreenNavigationProp } from './LocationListScreen';
import { useLocationRelationEditor } from './useLocationRelationEditor';
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
  /** Regions whose contents the author folded away, to read a big world at the level of its regions. */
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);

  const storyId = selectedStory?.id;
  const { userId } = useUserSettingsStore();
  const { canEdit } = useStoryRole(storyId);

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
    reload,
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

  const folded = useMemo(
    () => collapseLocationGraph(filtered.locations, filtered.relations, collapsedIds),
    [filtered, collapsedIds],
  );

  const layout = useMemo(
    () =>
      buildLocationGraphLayout(
        folded.locations,
        folded.relations,
        isCompact ? 'top-to-bottom' : 'left-to-right',
      ),
    [folded, isCompact],
  );

  const hiddenTotal = useMemo(
    () => [...folded.hiddenCounts.values()].reduce((sum, count) => sum + count, 0),
    [folded.hiddenCounts],
  );

  const toggleFold = useCallback((locationId: string) => {
    setCollapsedIds((current) =>
      current.includes(locationId)
        ? current.filter((id) => id !== locationId)
        : [...current, locationId],
    );
  }, []);

  const focus = useGraphFocus({
    nodes: layout.nodes,
    edges: layout.edges,
    ends: locationEnds,
    canvasRef,
    filterKey: selectedIds.join(','),
    clearFilter: () => setSelectedIds([]),
  });
  const { selectedNode, selectedNodeId, closeDetails } = focus;

  const editor = useLocationRelationEditor({
    db: drizzleDb,
    storyId,
    userId,
    locations,
    relations: graphRelations as never,
    reload,
  });

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
              dashed: true,
            },
          ]
        : []),
      ...(layout.edges.some((edge) => edge.relationType === 'connected_to')
        ? [
            {
              id: 'connected_to',
              label: t('location_relation_type_connected_to'),
              color: colors.textSecondary,
            },
          ]
        : []),
    ],
    [colors.primary, colors.textSecondary, layout.edges, t],
  );

  // What the sheet lists comes from the map before folding: a folded region still holds its places.
  const nameById = useMemo(
    () => new Map(filtered.locations.map((location) => [location.id, location.name])),
    [filtered.locations],
  );
  const nameOf = useCallback(
    (id: string) => nameById.get(id) ?? t('unknown_location'),
    [nameById, t],
  );

  const selectedParent = useMemo((): LocationNodeConnection | null => {
    if (!selectedNodeId) return null;
    const parent = filtered.relations.find(
      (relation) => relation.relationType === 'contains' && relation.locationBId === selectedNodeId,
    );
    return parent
      ? {
          relationId: parent.id,
          locationId: parent.locationAId,
          locationName: nameOf(parent.locationAId),
        }
      : null;
  }, [filtered.relations, nameOf, selectedNodeId]);

  const selectedChildren = useMemo((): LocationNodeConnection[] => {
    if (!selectedNodeId) return [];
    return filtered.relations
      .filter(
        (relation) =>
          relation.relationType === 'contains' && relation.locationAId === selectedNodeId,
      )
      .map((relation) => ({
        relationId: relation.id,
        locationId: relation.locationBId,
        locationName: nameOf(relation.locationBId),
      }));
  }, [filtered.relations, nameOf, selectedNodeId]);

  const selectedConnections = useMemo((): LocationNodeConnection[] => {
    if (!selectedNodeId) return [];
    return filtered.relations
      .filter(
        (relation) =>
          relation.relationType === 'connected_to' &&
          (relation.locationAId === selectedNodeId || relation.locationBId === selectedNodeId),
      )
      .map((relation) => {
        const otherId =
          relation.locationAId === selectedNodeId ? relation.locationBId : relation.locationAId;
        return { relationId: relation.id, locationId: otherId, locationName: nameOf(otherId) };
      });
  }, [filtered.relations, nameOf, selectedNodeId]);

  /** Where the place stands: the regions above it, from the outermost, e.g. `World › North`. */
  const ancestorPath = useMemo(() => {
    if (!selectedNodeId) return '';
    const names: string[] = [];
    const seen = new Set([selectedNodeId]);
    let current = selectedNodeId;
    for (;;) {
      const parent = filtered.relations.find(
        (relation) => relation.relationType === 'contains' && relation.locationBId === current,
      );
      if (!parent || seen.has(parent.locationAId)) break;
      seen.add(parent.locationAId);
      names.unshift(nameById.get(parent.locationAId) ?? '');
      current = parent.locationAId;
    }
    return names.filter(Boolean).join(' › ');
  }, [filtered.relations, nameById, selectedNodeId]);

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
      {collapsedIds.length > 0 && hiddenTotal > 0 && (
        <GraphFilterSummary
          colors={colors}
          hint={t('location_graph_folded_hint', { count: hiddenTotal })}
          clearLabel={t('location_graph_expand_all')}
          onClear={() => setCollapsedIds([])}
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
        hiddenCounts={folded.hiddenCounts}
        nodeAccessibilityLabel={(node) => {
          const label = t('graph_node_a11y', {
            name: node.location.name,
            count: degrees.get(node.id) ?? 0,
          });
          const hidden = folded.hiddenCounts.get(node.id);
          return hidden
            ? `${label}, ${t('location_graph_collapsed_hint', { count: hidden })}`
            : label;
        }}
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
          subtitle={ancestorPath ? { text: ancestorPath } : undefined}
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
                      trailing: canEdit
                        ? [
                            {
                              icon: 'trash-outline' as const,
                              label: `${t('remove')}: ${selectedParent.locationName}`,
                              destructive: true,
                              onPress: () => editor.removeParent(selectedNode.id),
                            },
                          ]
                        : undefined,
                    },
                  ]
                : [],
              actions: canEdit
                ? [
                    {
                      label: selectedParent ? t('change_parent') : t('set_parent'),
                      onPress: () => {
                        closeDetails();
                        editor.open('parent', selectedNode.id);
                      },
                    },
                  ]
                : undefined,
            },
            {
              title: t('child_locations'),
              emptyMessage: t('no_child_locations'),
              items: selectedChildren.map((connection) => ({
                id: connection.relationId,
                icon: 'arrow-down-outline' as const,
                label: connection.locationName,
                onPress: () => focus.selectNode(connection.locationId),
                trailing: canEdit
                  ? [
                      {
                        icon: 'trash-outline' as const,
                        label: `${t('remove')}: ${connection.locationName}`,
                        destructive: true,
                        onPress: () => editor.removeChild(connection.locationId),
                      },
                    ]
                  : undefined,
              })),
              actions: [
                ...(canEdit
                  ? [
                      {
                        label: t('add_child_location'),
                        onPress: () => {
                          closeDetails();
                          editor.open('child', selectedNode.id);
                        },
                      },
                    ]
                  : []),
                ...(selectedChildren.length > 0
                  ? [
                      {
                        label: collapsedIds.includes(selectedNode.id)
                          ? t('location_graph_expand')
                          : t('location_graph_collapse'),
                        icon: collapsedIds.includes(selectedNode.id)
                          ? ('chevron-down' as const)
                          : ('chevron-up' as const),
                        onPress: () => toggleFold(selectedNode.id),
                      },
                    ]
                  : []),
              ],
            },
            {
              title: t('connected_locations'),
              emptyMessage: t('no_connected_locations'),
              items: selectedConnections.map((connection) => ({
                id: connection.relationId,
                icon: 'git-network-outline' as const,
                label: connection.locationName,
                onPress: () => focus.selectNode(connection.locationId),
                trailing: canEdit
                  ? [
                      {
                        icon: 'trash-outline' as const,
                        label: `${t('remove')}: ${connection.locationName}`,
                        destructive: true,
                        onPress: () => editor.removeConnection(connection.relationId),
                      },
                    ]
                  : undefined,
              })),
              actions: canEdit
                ? [
                    {
                      label: t('add_connection'),
                      onPress: () => {
                        closeDetails();
                        editor.open('connection', selectedNode.id);
                      },
                    },
                  ]
                : undefined,
            },
          ]}
          actionLabel={t('location_graph_open_location')}
          onAction={() => handleOpenLocation(selectedNode.id)}
          onClose={closeDetails}
        />
      )}

      {editor.picking && (
        <LocationPickerModal
          isVisible
          onClose={editor.close}
          onSelect={(locationId) => void editor.pick(locationId)}
          title={editor.pickerTitle}
          candidates={editor.candidates}
        />
      )}
    </View>
  );
};

export default LocationGraphScreen;
