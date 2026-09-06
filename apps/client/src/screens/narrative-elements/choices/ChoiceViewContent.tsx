import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { commonDetailStyleDefs, commonScreenStyleDefs } from '../../../theme/commonStyles';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import GraphNodeSheet from '@/src/components/features/graphs/GraphNodeSheet/GraphNodeSheet';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import StoryGraphCanvas from '@/src/components/features/graphs/StoryGraph/StoryGraphCanvas';
import { describeEffect } from '../../../utils/choiceCheckEffectDescriptions';
import {
  formatSceneGap,
  formatSceneUniverseDuration,
  hasSceneGap,
  hasSceneUniverseDuration,
} from '../../../utils/sceneTiming';

export function ChoiceViewContent(props: any) {
  const {
    t,
    colors,
    calendar,
    navigation,
    canvasRef,
    selectedStory,
    plots,
    selectedPlotIds,
    setSelectedPlotIds,
    layout,
    showEdgeLabels,
    highlightedNodeIds,
    selectedNodeId,
    setSelectedNodeId,
    handleSelectNode,
    setLabelsOverride,
    exporting,
    handleExport,
    selectedNode,
    selectedSceneEffects,
    itemNamesById,
    connections,
    handleOpenScene,
    mapSubtitle,
    loading,
    error,
  } = props;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        ...commonScreenStyleDefs(colors),
        ...commonDetailStyleDefs(colors),
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
          // Without this the horizontal ScrollView stretches vertically and eats half the screen: inside a column
          // container it grows along the cross axis by default.
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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {selectedStory.title}
          </Text>
        )}
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {mapSubtitle}
        </Text>
        {plots.length ? (
          <View style={{ paddingHorizontal: 12, paddingTop: 8, zIndex: 5 }}>
            <MultiSelectPill
              options={plots.map((plot: any) => ({
                value: plot.id,
                label: plot.name,
              }))}
              selectedValues={selectedPlotIds}
              onSelectionChange={setSelectedPlotIds}
              placeholder={t('story_map_filter_plots')}
            />
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.legendBar}
          contentContainerStyle={styles.legendContent}
        >
          {layout.chapters.map((chapter: any) => (
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
            {t('story_map_dangling_choices', {
              count: layout.danglingChoiceCount,
            })}
          </Text>
        </View>
      )}

      <StoryGraphCanvas
        ref={canvasRef}
        layout={layout}
        showEdgeLabels={showEdgeLabels}
        selectedNodeId={selectedNodeId}
        highlightedNodeIds={highlightedNodeIds}
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
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="image-outline" size={20} color={colors.text} />
          )}
        </TouchableOpacity>
      </View>

      {selectedNode && (
        <GraphNodeSheet
          title={selectedNode.scene.name}
          subtitle={
            selectedNode.chapterName
              ? {
                  text: selectedNode.chapterName,
                  color: selectedNode.chapterColor,
                }
              : undefined
          }
          badges={[
            ...(selectedNode.isStart
              ? [{ label: t('story_map_badge_start'), color: colors.accent }]
              : []),
            ...(selectedNode.isFinish
              ? [{ label: t('story_map_badge_finish'), color: colors.error }]
              : []),
            ...(selectedNode.isDetached
              ? [
                  {
                    label: t('story_map_badge_detached'),
                    color: colors.textSecondary,
                  },
                ]
              : []),
          ]}
          sections={[
            ...(selectedNode.scene.summary
              ? [
                  {
                    title: t('summary'),
                    description: selectedNode.scene.summary,
                  },
                ]
              : []),
            ...(hasSceneGap(selectedNode.scene) || hasSceneUniverseDuration(selectedNode.scene)
              ? [
                  {
                    title: t('scene_timing'),
                    description: [
                      hasSceneGap(selectedNode.scene)
                        ? `${t('gap')}: ${formatSceneGap(selectedNode.scene, t, {
                            normalize: selectedStory?.normalizeSceneTiming,
                            calendar,
                          })}`
                        : null,
                      hasSceneUniverseDuration(selectedNode.scene)
                        ? `${t('in_universe_duration')}: ${formatSceneUniverseDuration(
                            selectedNode.scene,
                            t,
                            {
                              normalize: selectedStory?.normalizeSceneTiming,
                              calendar,
                            },
                          )}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join('\n'),
                  },
                ]
              : []),
            ...(selectedSceneEffects.length > 0
              ? [
                  {
                    title: t('effects_title'),
                    description: selectedSceneEffects
                      .map((effect: any) => `• ${describeEffect(effect, itemNamesById, t)}`)
                      .join('\n'),
                  },
                ]
              : []),
            {
              title: t('story_map_outgoing_choices'),
              emptyMessage: t('story_map_no_outgoing_choices'),
              items: connections.outgoing.map((connection: any) => ({
                id: connection.choiceId,
                icon: 'arrow-forward' as const,
                label: connection.text || t('story_map_implicit_choice'),
                detail: connection.sceneName,
                extra: connection.extra,
                italicLabel: !connection.text,
                onPress: () => setSelectedNodeId(connection.sceneId),
              })),
            },
            {
              title: t('story_map_incoming_choices'),
              emptyMessage: t('story_map_no_incoming_choices'),
              items: connections.incoming.map((connection: any) => ({
                id: connection.choiceId,
                icon: 'arrow-back' as const,
                label: connection.text || t('story_map_implicit_choice'),
                detail: connection.sceneName,
                extra: connection.extra,
                italicLabel: !connection.text,
                onPress: () => setSelectedNodeId(connection.sceneId),
              })),
            },
          ]}
          actionLabel={t('story_map_open_scene')}
          onAction={() => handleOpenScene(selectedNode.id)}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </View>
  );
}
