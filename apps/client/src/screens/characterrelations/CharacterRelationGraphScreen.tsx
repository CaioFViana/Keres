import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import CharacterRelationNodeSheet, { CharacterRelationNodeConnection } from '../../components/CharacterRelationGraph/CharacterRelationNodeSheet';
import CharacterRelationGraphCanvas, { CharacterRelationGraphCanvasHandle } from '../../components/CharacterRelationGraph/CharacterRelationGraphCanvas';
import { useDrizzle } from '../../db';
import { CharacterSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { createCharacterService } from '../../services/storymanagement/CharacterService';
import { createCharacterRelationService, CharacterRelationWithNames } from '../../services/storymanagement/CharacterRelationService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';
import { buildCharacterRelationGraphLayout, RelationGraphNode } from '../../utils/characterRelationGraphLayout';
import { renderCharacterRelationMapSvg } from '../../utils/characterRelationGraphSvg';
import { buildCharacterRelationMapFileName, deliverSvgMap } from '../../utils/storyTransfer';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { CharacterRelationsScreenNavigationProp } from './CharacterRelationListScreen';

/**
 * Mapa de relações: os personagens de uma história e quem conhece quem.
 *
 * Espelha o mapa de história (`ChoiceViewScreen`) na experiência - painel de detalhe ao
 * tocar num nó, pan/zoom, rótulos que se escondem sozinhos quando o grafo cresce - mas o
 * layout de fundo é outro (`characterRelationGraphLayout`), porque relação entre personagens
 * não tem direção nem "início": ver `characterRelationGraphLayout.ts` para o porquê.
 */

/** Acima disso o tipo de relação em cada aresta polui mais do que informa; a pessoa pode reativar. */
const EDGE_LABEL_AUTO_LIMIT = 40;

const CharacterRelationGraphScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<CharacterRelationsScreenNavigationProp>();
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();
  const { showNotification } = useNotificationStore();

  const canvasRef = useRef<CharacterRelationGraphCanvasHandle>(null);

  const [characters, setCharacters] = useState<CharacterSelect[]>([]);
  const [relations, setRelations] = useState<CharacterRelationWithNames[]>([]);
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

  // Recarrega ao focar: personagens e relações podem ter mudado em outra tela.
  useFocusEffect(useCallback(() => {
    loadGraph();
  }, [loadGraph]));

  useEffect(() => {
    const handleRemoteChange = (change: { storyId?: string }) => {
      if (change?.storyId === storyId) {
        loadGraph();
      }
    };
    entityEventEmitter.on('story_data_changed', handleRemoteChange);
    return () => entityEventEmitter.off('story_data_changed', handleRemoteChange);
  }, [storyId, loadGraph]);

  useFocusEffect(useCallback(() => {
    setDocumentTitle(t('character_relation_map_title'));
    navigation.getParent()?.setOptions({ title: t('character_relation_map_title'), headerRight: undefined });
  }, [navigation, t]));

  const layout = useMemo(
    () => buildCharacterRelationGraphLayout(characters, relations),
    [characters, relations]
  );

  const showEdgeLabels = labelsOverride ?? layout.edges.length <= EDGE_LABEL_AUTO_LIMIT;

  const selectedNode = useMemo(
    () => layout.nodes.find(node => node.id === selectedNodeId) ?? null,
    [layout.nodes, selectedNodeId]
  );

  const connections = useMemo((): CharacterRelationNodeConnection[] => {
    if (!selectedNodeId) return [];
    const nameById = new Map(layout.nodes.map(node => [node.id, node.character.name]));

    return layout.edges
      .filter(edge => edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId)
      .map(edge => {
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

  const handleOpenCharacter = useCallback((characterId: string) => {
    setSelectedNodeId(null);
    navigation.navigate('CharactersStack', { screen: 'CharacterDetail', params: { characterId } });
  }, [navigation]);

  const mapSubtitle = useMemo(
    () => t('character_relation_map_subtitle', {
      characterCount: layout.nodes.length,
      relationCount: layout.edges.length,
      isolatedCount: layout.isolatedCount,
    }),
    [layout.edges.length, layout.isolatedCount, layout.nodes.length, t]
  );

  const handleExport = useCallback(async () => {
    if (!selectedStory || layout.nodes.length === 0) return;

    setExporting(true);
    try {
      const svg = renderCharacterRelationMapSvg(layout, {
        title: selectedStory.title,
        subtitle: mapSubtitle,
        showEdgeLabels,
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
        },
      });

      const result = await deliverSvgMap(svg, buildCharacterRelationMapFileName(selectedStory.title));
      if (result.delivered) {
        showNotification(t('character_relation_map_export_success', { fileName: result.fileName }), 'success');
      } else {
        // Sem share sheet o arquivo existe, mas o usuário não tem como alcançá-lo; dizer onde
        // ele está é mais útil do que alegar sucesso.
        showNotification(t('character_relation_map_export_no_share_target', { path: result.uri || result.fileName }), 'warning');
      }
    } catch (exportError) {
      console.log('CharacterRelationGraphScreen: failed to export relation map.', exportError);
      showNotification(t('character_relation_map_export_failed'), 'error');
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
          <Text style={styles.headerTitle} numberOfLines={1}>{selectedStory.title}</Text>
        )}
        <Text style={styles.headerSubtitle} numberOfLines={1}>{mapSubtitle}</Text>
      </View>

      <CharacterRelationGraphCanvas
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
          {exporting
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="image-outline" size={20} color={colors.text} />}
        </TouchableOpacity>
      </View>

      <CharacterRelationNodeSheet
        node={selectedNode}
        connections={connections}
        onClose={() => setSelectedNodeId(null)}
        onOpenCharacter={handleOpenCharacter}
        onSelectCharacter={setSelectedNodeId}
      />
    </View>
  );
};

export default CharacterRelationGraphScreen;
