import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import LocationNodeSheet, { LocationNodeConnection } from '../../components/LocationGraph/LocationNodeSheet';
import LocationGraphCanvas, { LocationGraphCanvasHandle } from '../../components/LocationGraph/LocationGraphCanvas';
import { useDrizzle } from '../../db';
import { LocationRelationSelect, LocationSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { createLocationService } from '../../services/storymanagement/LocationService';
import { createLocationRelationService } from '../../services/storymanagement/LocationRelationService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { buildLocationGraphLayout, GraphLocationRelation, LocationGraphNode, LocationRelationKind } from '../../utils/locationGraphLayout';
import { LocationsScreenNavigationProp } from './LocationListScreen';

/**
 * Grafo de estrutura de Locations: cada Location vira um nó, `contains`/`connected_to` viram
 * arestas. Espelha `CharacterRelationGraphScreen` na experiência (pan/zoom, painel de detalhe
 * ao tocar num nó), mas com layout em árvore (`locationGraphLayout`) em vez de radial, porque
 * `contains` tem hierarquia e `connected_to` não.
 *
 * Só visualização/navegação nesta etapa - sem edição visual (arrastar para reparentar etc.).
 */

const LocationGraphScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<LocationsScreenNavigationProp>();
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();

  const canvasRef = useRef<LocationGraphCanvasHandle>(null);

  const [locations, setLocations] = useState<LocationSelect[]>([]);
  const [relations, setRelations] = useState<LocationRelationSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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
  useFocusEffect(useCallback(() => {
    loadGraph();
  }, [loadGraph]));

  useFocusEffect(useCallback(() => {
    navigation.getParent()?.setOptions({ title: t('location_graph_title'), headerRight: undefined });
  }, [navigation, t]));

  const graphRelations = useMemo((): GraphLocationRelation[] =>
    relations
      .filter(r => !r.isDeleted)
      .map(r => ({ ...r, relationType: r.relationType as LocationRelationKind })),
    [relations]
  );

  const layout = useMemo(
    () => buildLocationGraphLayout(locations, graphRelations),
    [locations, graphRelations]
  );

  const selectedNode = useMemo(
    () => layout.nodes.find(node => node.id === selectedNodeId) ?? null,
    [layout.nodes, selectedNodeId]
  );

  const nameById = useMemo(() => new Map(layout.nodes.map(node => [node.id, node.location.name])), [layout.nodes]);

  const selectedParent = useMemo((): LocationNodeConnection | null => {
    if (!selectedNodeId) return null;
    const parentEdge = layout.edges.find(edge => edge.relationType === 'contains' && edge.targetId === selectedNodeId);
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
      .filter(edge => edge.relationType === 'contains' && edge.sourceId === selectedNodeId)
      .map(edge => ({
        relationId: edge.id,
        locationId: edge.targetId,
        locationName: nameById.get(edge.targetId) ?? t('unknown_location'),
      }));
  }, [layout.edges, selectedNodeId, nameById, t]);

  const selectedConnections = useMemo((): LocationNodeConnection[] => {
    if (!selectedNodeId) return [];
    return layout.edges
      .filter(edge => edge.relationType === 'connected_to' && (edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId))
      .map(edge => {
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

  const handleOpenLocation = useCallback((locationId: string) => {
    setSelectedNodeId(null);
    navigation.navigate('LocationDetail', { locationId });
  }, [navigation]);

  const graphSubtitle = useMemo(
    () => t('location_graph_subtitle', {
      locationCount: layout.nodes.length,
      relationCount: layout.edges.length,
      isolatedCount: layout.isolatedCount,
    }),
    [layout.edges.length, layout.isolatedCount, layout.nodes.length, t]
  );

  const styles = useMemo(() => StyleSheet.create({
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
          <Text style={styles.headerTitle} numberOfLines={1}>{selectedStory.title}</Text>
        )}
        <Text style={styles.headerSubtitle} numberOfLines={1}>{graphSubtitle}</Text>
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
      </View>

      <LocationNodeSheet
        node={selectedNode}
        parent={selectedParent}
        children={selectedChildren}
        connections={selectedConnections}
        onClose={() => setSelectedNodeId(null)}
        onOpenLocation={handleOpenLocation}
        onSelectLocation={setSelectedNodeId}
      />
    </View>
  );
};

export default LocationGraphScreen;
