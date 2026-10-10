import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StorySimulation } from '../../../hooks/useStorySimulation';
import { useTheme } from '../../../theme';
import { MarkdownPreview } from '../manuscript/MarkdownPreview/MarkdownPreview';

interface NavigatorScenePanelProps {
  simulation: StorySimulation;
  /** What the card shows of the scene: the navigator its summary, the manuscript the text itself. */
  content: 'summary' | 'body';
  onOpenScene?: (sceneId: string) => void;
  /** Less air above the card, where the screen already has a toolbar over it. */
  dense?: boolean;
  /** Commented passages of the body, marked when the body is shown (review mode). */
  commentExcerpts?: string[];
  /** Tapping a marked passage. */
  onCommentPress?: () => void;
  /** Ref of the body's container: what the web reads a text selection through. */
  bodyRef?: (node: unknown) => void;
}

/** The current scene of a simulated walk: its content, the carried state, and the choices at hand. */
export default function NavigatorScenePanel({
  simulation,
  content,
  onOpenScene,
  dense = false,
  commentExcerpts,
  onCommentPress,
  bodyRef,
}: NavigatorScenePanelProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { current, state, activity, available, activeItems, activeTriggers } = simulation;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 16,
          marginTop: dense ? 4 : 16,
        },
        title: { color: colors.text, fontWeight: '700', fontSize: 18 },
        summary: { color: colors.text, fontSize: 16, lineHeight: 25, marginTop: 10 },
        body: { marginTop: 10 },
        muted: { color: colors.textSecondary, fontStyle: 'italic', marginTop: 10 },
        choice: {
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 8,
          padding: 12,
          marginTop: 10,
        },
        unavailable: { opacity: 0.45, borderColor: colors.border },
        choiceText: { color: colors.text, fontWeight: '600' },
        blockedReason: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
        state: { color: colors.textSecondary, marginTop: 16 },
        activity: { color: colors.textSecondary, marginTop: 6 },
      }),
    [colors, dense],
  );

  if (!current) return <Text style={styles.muted}>{t('navigator_no_scenes')}</Text>;

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onOpenScene ? () => onOpenScene(current.id) : undefined}>
        <Text testID="navigator-scene-title" style={styles.title}>
          {current.name}
        </Text>
      </TouchableOpacity>
      {content === 'body' ? (
        current.body ? (
          <View style={styles.body} ref={bodyRef} collapsable={false}>
            <MarkdownPreview
              text={current.body}
              commentExcerpts={commentExcerpts}
              onCommentPress={onCommentPress}
            />
          </View>
        ) : (
          <Text style={styles.muted}>{t('manuscript_no_body_yet')}</Text>
        )
      ) : (
        <Text style={current.summary ? styles.summary : styles.muted}>
          {current.summary || t('plot_reader_no_summary')}
        </Text>
      )}
      <Text style={styles.state}>
        {t('navigator_state', {
          visits: state.sceneVisits.size,
          items: state.inventory.size,
          triggers: state.triggers.size,
        })}
      </Text>
      <Text style={styles.activity}>
        {t('navigator_active_items', {
          items: activeItems.length ? activeItems.join(', ') : t('navigator_none'),
        })}
      </Text>
      <Text style={styles.activity}>
        {t('navigator_active_triggers', {
          triggers: activeTriggers.length ? activeTriggers.join(', ') : t('navigator_none'),
        })}
      </Text>
      {activity.map((entry, index) => (
        <Text key={`${entry}-${index}`} style={styles.activity}>
          • {entry}
        </Text>
      ))}
      {available.map(({ choice, evaluation }) => (
        <TouchableOpacity
          key={choice.id}
          disabled={!evaluation.available}
          onPress={() => simulation.choose(choice.id)}
          style={[styles.choice, !evaluation.available && styles.unavailable]}
          accessibilityLabel={
            evaluation.available
              ? choice.text
              : `${choice.text}. ${simulation.unavailableReason(evaluation)}`
          }
        >
          <Text style={styles.choiceText}>{choice.text}</Text>
          {!evaluation.available ? (
            <Text style={styles.blockedReason}>{simulation.unavailableReason(evaluation)}</Text>
          ) : null}
        </TouchableOpacity>
      ))}
      {available.length === 0 ? (
        <Text style={styles.muted}>{t('navigator_no_choices')}</Text>
      ) : null}
    </View>
  );
}
