import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import GraphNodeSheet from '@/src/components/features/graphs/GraphNodeSheet/GraphNodeSheet';
import LocationGraphCanvas, {
  LocationGraphCanvasHandle,
} from '@/src/components/features/graphs/LocationGraph/LocationGraphCanvas';
import { useDrizzle } from '../../db';
import { LocationRelationSelect, LocationSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { createLocationService } from '../../services/storymanagement/LocationService';
import { createLocationRelationService } from '../../services/storymanagement/LocationRelationService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';
import {
  buildLocationGraphLayout,
  GraphLocationRelation,
  LocationGraphNode,
  LocationRelationKind,
} from '../../utils/locationGraphLayout';
import { renderLocationGraphMapSvg } from '../../utils/locationGraphSvg';
import { buildLocationGraphMapFileName, deliverSvgMap } from '../../utils/storyTransfer';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { LocationsScreenNavigationProp } from './LocationListScreen';

/**
 * Grafo de estrutura de Locations: cada Location vira um nó, `contains`/`connected_to` viram
 * arestas. Espelha `CharacterRelationGraphScreen` na experiência (pan/zoom, painel de detalhe
 * ao tocar num nó), mas com layout em árvore (`locationGraphLayout`) em vez de radial, porque
 * `contains` tem hierarquia e `connected_to` não.
 *
 * Só visualização/navegação nesta etapa - sem edição visual (arrastar para reparentar etc.).
 */

interface LocationNodeConnection {
  relationId: string;
  locationId: string;
  locationName: string;
}

const LocationGraphScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<LocationsScreenNavigationProp>();
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();
  const { showNotification } = useNotificationStore();
  const { isCompact } = useResponsiveLayout();

  const canvasRef = useRef<LocationGraphCanvasHandle>(null);

  const [locations, setLocations] = useState<LocationSelect[]>([]);
  const [relations, setRelations] = useState<LocationRelationSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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

  // Recarrega ao focar: locations e relações podem ter mudado em outra tela.
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
      setDocumentTitle(t('location_graph_title'));
      navigation
        .getParent()
        ?.setOptions({ title: t('location_graph_title'), headerRight: undefined });
    }, [navigation, t]),
  );

  const graphRelations = useMemo(
    (): GraphLocationRelation[] =>
      relations
        .filter((r) => !r.isDeleted)
        .map((r) => ({ ...r, relationType: r.relationType as LocationRelationKind })),
    [relations],
  );

  const layout = useMemo(
    () =>
      buildLocationGraphLayout(
        locations,
        graphRelations,
        isCompact ? 'top-to-bottom' : 'left-to-right',
      ),
    [locations, graphRelations, isCompact],
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

  const handleExport = useCallback(async () => {
    if (!selectedStory || layout.nodes.length === 0) return;

    setExporting(true);
    try {
      const svg = renderLocationGraphMapSvg(layout, {
        title: selectedStory.title,
        subtitle: graphSubtitle,
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
      });

      const result = await deliverSvgMap(svg, buildLocationGraphMapFileName(selectedStory.title));
      if (result.delivered) {
        showNotification(
          t('location_graph_export_success', { fileName: result.fileName }),
          'success',
        );
      } else {
        // Sem share sheet o arquivo existe, mas o usuário não tem como alcançá-lo; dizer onde
        // ele está é mais útil do que alegar sucesso.
        showNotification(
          t('location_graph_export_no_share_target', { path: result.uri || result.fileName }),
          'warning',
        );
      }
    } catch (exportError) {
      console.log('LocationGraphScreen: failed to export location graph.', exportError);
      showNotification(t('location_graph_export_failed'), 'error');
    } finally {
      setExporting(false);
    }
  }, [colors, layout, graphSubtitle, selectedStory, showNotification, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
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
          <Ionicons name="map-outline" size={54} color={colors.textSecondary} />
          <Text style={styles.emptyText}>{t('location_graph_empty')}</Text>
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
          {graphSubtitle}
        </Text>
      </View>

      <LocationGraphCanvas
        ref={canvasRef}
        layout={layout}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectNode}
      />

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => canvasRef.current?.zoomBy(1.25)}
          accessibilityLabel={t('location_graph_zoom_in')}
        >
          <Ionicons name="add" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => canvasRef.current?.zoomBy(0.8)}
          accessibilityLabel={t('location_graph_zoom_out')}
        >
          <Ionicons name="remove" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => canvasRef.current?.fitToScreen()}
          accessibilityLabel={t('location_graph_fit')}
        >
          <Ionicons name="scan-outline" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleExport}
          disabled={exporting}
          accessibilityLabel={t('location_graph_export')}
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
