import { Ionicons } from '@expo/vector-icons';
import type { ScenePosition } from '@keres/shared';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import type { ChapterAnchorRow } from '@/src/hooks/useChapterAnchors';
import { useChapterAnchors } from '@/src/hooks/useChapterAnchors';
import { useNotificationStore } from '@/src/state/notificationStore';
import { useTheme } from '@/src/theme';
import { AppAlert } from '@/src/utils/AppAlert';
import type { AnchorDraft } from './AnchorEditModal';
import AnchorEditModal from './AnchorEditModal';

/**
 * "When does this happen?", for a chapter or an event.
 *
 * The answer is one or more stretches, each read back as a sentence rather than as a form: a writer
 * checking their own timeline should be able to skim this section without decoding it. A container
 * that pauses and resumes has several stretches, which is exactly what an interval relation could
 * never say and the reason this replaced it.
 *
 * Nothing here is required. A chapter with no anchor simply happens when it is told, which is the
 * ordinary case and should cost nothing to leave alone.
 */

interface Props {
  storyId: string;
  chapterId: string;
  currentUserId: string | null;
  editable: boolean;
}

const AnchorManager: React.FC<Props> = ({ storyId, chapterId, currentUserId, editable }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const notify = useNotificationStore((state) => state.showNotification);
  const {
    anchors,
    scenes,
    sceneNames,
    hasContents,
    save: persist,
    remove: erase,
  } = useChapterAnchors(storyId, chapterId, currentUserId);
  const [editing, setEditing] = useState<{ id: string | null; draft?: AnchorDraft } | null>(null);

  /** One end of a stretch, as a sentence. The offset, when there is one, leads. */
  const describePoint = useCallback(
    (
      sceneId: string,
      position: ScenePosition,
      offset: number | null,
      offsetUnit: string | null,
    ) => {
      const at = t('anchor_point_at', {
        position: t(`scene_position_${position}`),
        scene: sceneNames.get(sceneId) ?? t('common_na'),
      });
      if (!offset || !offsetUnit) return at;
      return t('anchor_point_offset', {
        amount: Math.abs(offset),
        unit: t(offsetUnit),
        direction: t(offset < 0 ? 'anchor_direction_before' : 'anchor_direction_after'),
        at,
      });
    },
    [sceneNames, t],
  );

  const save = useCallback(
    async (draft: AnchorDraft) => {
      if (!editing) return;
      try {
        await persist(draft, editing.id);
        setEditing(null);
      } catch (error) {
        console.log('AnchorManager: failed to save anchor.', error);
        notify(t('anchor_save_failed'), 'error');
      }
    },
    [editing, notify, persist, t],
  );

  const remove = useCallback(
    (anchor: ChapterAnchorRow) => {
      AppAlert.alert(t('anchor_delete_title'), t('anchor_delete_message'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await erase(anchor.id);
            } catch (error) {
              console.log('AnchorManager: failed to delete anchor.', error);
              notify(t('anchor_save_failed'), 'error');
            }
          },
        },
      ]);
    },
    [erase, notify, t],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 8,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        sentence: { flexGrow: 1, flexShrink: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
        order: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
        empty: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, paddingVertical: 6 },
        add: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
        addText: { fontSize: 14, fontWeight: '700', color: colors.primary },
      }),
    [colors],
  );

  return (
    <CollapsibleCard title={t('anchor_section_title')} initialExpanded={anchors.length > 0}>
      {anchors.length === 0 && <Text style={styles.empty}>{t('anchor_empty')}</Text>}
      {anchors.map((anchor) => (
        <View key={anchor.id} style={styles.row}>
          <View style={{ flexGrow: 1, flexShrink: 1 }}>
            {anchors.length > 1 && (
              <Text style={styles.order}>{t('anchor_stretch', { order: anchor.order })}</Text>
            )}
            <Text style={styles.sentence}>
              {anchor.endSceneId
                ? t('anchor_sentence', {
                    from: describePoint(
                      anchor.startSceneId,
                      anchor.startPosition,
                      anchor.startOffset,
                      anchor.startOffsetUnit,
                    ),
                    to: describePoint(
                      anchor.endSceneId,
                      anchor.endPosition ?? 'end',
                      anchor.endOffset,
                      anchor.endOffsetUnit,
                    ),
                  })
                : t(hasContents ? 'anchor_sentence_open' : 'anchor_sentence_instant', {
                    from: describePoint(
                      anchor.startSceneId,
                      anchor.startPosition,
                      anchor.startOffset,
                      anchor.startOffsetUnit,
                    ),
                  })}
            </Text>
          </View>
          {editable && (
            <>
              <TouchableOpacity
                onPress={() =>
                  setEditing({
                    id: anchor.id,
                    draft: {
                      startSceneId: anchor.startSceneId,
                      startPosition: anchor.startPosition,
                      startOffset: anchor.startOffset,
                      startOffsetUnit: anchor.startOffsetUnit,
                      endSceneId: anchor.endSceneId,
                      endPosition: anchor.endPosition,
                      endOffset: anchor.endOffset,
                      endOffsetUnit: anchor.endOffsetUnit,
                    },
                  })
                }
                accessibilityLabel={t('edit')}
              >
                <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(anchor)} accessibilityLabel={t('delete')}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </>
          )}
        </View>
      ))}
      {editable && !anchors.some((anchor) => !anchor.endSceneId) && (
        <TouchableOpacity style={styles.add} onPress={() => setEditing({ id: null })}>
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.addText}>{t('anchor_add')}</Text>
        </TouchableOpacity>
      )}
      <AnchorEditModal
        visible={editing !== null}
        initial={editing?.draft}
        scenes={scenes}
        hasContents={hasContents}
        allowOpenStretch={anchors.filter((anchor) => anchor.id !== editing?.id).length === 0}
        onCancel={() => setEditing(null)}
        onConfirm={save}
      />
    </CollapsibleCard>
  );
};

export default AnchorManager;
