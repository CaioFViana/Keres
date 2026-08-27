import GraphNodeSheet from '@/src/components/features/graphs/GraphNodeSheet/GraphNodeSheet';
import type { ChapterAnchorSelect, ChapterSelect, SceneSelect } from '@/src/db/schema';
import { useTheme } from '@/src/theme';
import { formatSceneGap, formatSceneUniverseDuration } from '@/src/utils/sceneTiming';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  scenes: SceneSelect[];
  chapters: ChapterSelect[];
  events: ChapterSelect[];
  anchors: ChapterAnchorSelect[];
  selectedSceneId: string | null;
  selectedEventId: string | null;
  onSelectScene: (id: string | null) => void;
  onSelectEvent: (id: string | null) => void;
  onOpenEvent: (id: string) => void;
}

/**
 * The two node sheets the timeline opens: a scene's timing, and an event's placement plus the
 * scenes it contains. Kept off the screen so the drawing chrome stays readable.
 */
const StoryTimelineSheets: React.FC<Props> = ({
  scenes,
  chapters,
  events,
  anchors,
  selectedSceneId,
  selectedEventId,
  onSelectScene,
  onSelectEvent,
  onOpenEvent,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  const selectedChapter =
    chapters.find((chapter) => chapter.id === selectedScene?.chapterId) ??
    events.find((event) => event.id === selectedScene?.chapterId) ??
    null;
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const selectedEventAnchors = anchors
    .filter((anchor) => anchor.chapterId === selectedEventId)
    .sort((a, b) => a.order - b.order);
  const selectedEventScenes = scenes
    .filter((scene) => scene.chapterId === selectedEventId)
    .sort((a, b) => a.index - b.index);

  const sceneLabel = (sceneId: string) =>
    scenes.find((scene) => scene.id === sceneId)?.name ?? t('common_na');
  const describeAnchorPoint = (
    sceneId: string | null,
    position: string | null,
    offset: number | null,
    offsetUnit: string | null,
  ) => {
    if (!sceneId) return t('common_na');
    const at = t('anchor_point_at', {
      position: t(`scene_position_${position ?? 'start'}`),
      scene: sceneLabel(sceneId),
    });
    if (!offset || !offsetUnit) return at;
    return t('anchor_point_offset', {
      amount: Math.abs(offset),
      unit: t(offsetUnit),
      direction: t(offset < 0 ? 'anchor_direction_before' : 'anchor_direction_after'),
      at,
    });
  };

  return (
    <>
      {selectedScene && (
        <GraphNodeSheet
          title={selectedScene.name}
          subtitle={{ text: selectedChapter?.name ?? '' }}
          badges={[
            {
              label: `${t('story_timeline_gap')}: ${formatSceneGap(selectedScene, t)}`,
              color: colors.textSecondary,
            },
            {
              label: `${t('story_timeline_duration')}: ${formatSceneUniverseDuration(selectedScene, t)}`,
              color: colors.primary,
            },
          ]}
          sections={[{ title: t('summary'), description: selectedScene.summary || t('common_na') }]}
          actionLabel={t('close')}
          onAction={() => onSelectScene(null)}
          onClose={() => onSelectScene(null)}
        />
      )}
      {selectedEvent && (
        <GraphNodeSheet
          title={selectedEvent.name}
          subtitle={{ text: t('story_timeline_event') }}
          sections={[
            {
              title: t('anchor_section_title'),
              description:
                selectedEventAnchors
                  .map((anchor) =>
                    anchor.endSceneId
                      ? t('anchor_sentence', {
                          from: describeAnchorPoint(
                            anchor.startSceneId,
                            anchor.startPosition,
                            anchor.startOffset,
                            anchor.startOffsetUnit,
                          ),
                          to: describeAnchorPoint(
                            anchor.endSceneId,
                            anchor.endPosition,
                            anchor.endOffset,
                            anchor.endOffsetUnit,
                          ),
                        })
                      : t(
                          selectedEventScenes.length > 0
                            ? 'anchor_sentence_open'
                            : 'anchor_sentence_instant',
                          {
                            from: describeAnchorPoint(
                              anchor.startSceneId,
                              anchor.startPosition,
                              anchor.startOffset,
                              anchor.startOffsetUnit,
                            ),
                          },
                        ),
                  )
                  .join('\n') || t('anchor_empty'),
            },
            {
              title: t('scenes_title'),
              emptyMessage: t('story_timeline_event_no_scenes'),
              items: selectedEventScenes.map((scene) => ({
                id: scene.id,
                icon: 'film-outline' as const,
                label: scene.name,
                detail: formatSceneUniverseDuration(scene, t),
                onPress: () => {
                  onSelectEvent(null);
                  onSelectScene(scene.id);
                },
              })),
            },
            { title: t('summary'), description: selectedEvent.summary || t('common_na') },
          ]}
          actionLabel={t('story_timeline_open_event')}
          onAction={() => {
            const eventId = selectedEvent.id;
            onSelectEvent(null);
            onOpenEvent(eventId);
          }}
          onClose={() => onSelectEvent(null)}
        />
      )}
    </>
  );
};

export default StoryTimelineSheets;
