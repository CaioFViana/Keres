import { Ionicons } from '@expo/vector-icons';
import { SCENE_MUSIC_ROLES, type SceneMusicRole } from '@keres/shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { SceneMusicView } from '@/src/hooks/useSceneMusic';
import { useTheme } from '@/src/theme';
import { AppAlert } from '@/src/utils/AppAlert';

interface SceneMusicCardProps {
  view: SceneMusicView;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  onCueCommit: (cue: string) => void;
  onRoleChange: (role: SceneMusicRole) => void;
  /** The sections of the song this scene sings; `null` is the whole song. */
  onSectionsChange: (sections: string[] | null) => void;
  onMove: (delta: -1 | 1) => void;
  onReplace: () => void;
  onDelete: () => void;
  /** Opens what it points at: the song to edit, or the medium to look at. */
  onOpen: () => void;
  /** Plays what this scene sings of the song; absent for anything that is not a song. */
  onListen?: () => void;
  /** This piece is the one playing (or being prepared). */
  listening?: boolean;
}

const KIND_ICON = {
  song: 'musical-notes-outline',
  audio: 'volume-medium-outline',
  link: 'link-outline',
} as const;
/** The least a thing to touch should be, in points. */
const TOUCH = 44;

/**
 * One piece of music of a scene. What it is comes first, as something to open and, for a song, to
 * hear as this scene sings it; whether the story hears it is a two-way choice; the rest (which parts,
 * when it comes in) is below. Moving, replacing and removing are rare, so they sit behind one button
 * instead of four icons of the same weight beside the name.
 */
const SceneMusicCard: React.FC<SceneMusicCardProps> = ({
  view,
  isFirst,
  isLast,
  canEdit,
  onCueCommit,
  onRoleChange,
  onSectionsChange,
  onMove,
  onReplace,
  onDelete,
  onOpen,
  onListen,
  listening = false,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { music } = view;
  // What is being typed, tied to the saved cue it started from: once the save lands (or another device
  // changes the cue) the saved cue wins again, without an effect to copy it over.
  const [draft, setDraft] = useState<{ base: string | null; text: string } | null>(null);
  const cue = draft && draft.base === music.cue ? draft.text : (music.cue ?? '');

  const openMenu = () =>
    AppAlert.alert(view.targetName ?? t('scene_music_removed'), undefined, [
      ...(isFirst ? [] : [{ text: t('scene_music_move_up'), onPress: () => onMove(-1) }]),
      ...(isLast ? [] : [{ text: t('scene_music_move_down'), onPress: () => onMove(1) }]),
      { text: t('scene_music_change'), onPress: onReplace },
      { text: t('delete'), style: 'destructive' as const, onPress: onDelete },
      { text: t('cancel'), style: 'cancel' as const },
    ]);

  const subtitle = view.targetGone
    ? null
    : view.targetKind === 'song'
      ? [view.songFacts, music.sections ? music.sections.join(', ') : null]
          .filter(Boolean)
          .join(' · ') || t('scene_music_kind_song')
      : t(`scene_music_kind_${view.targetKind ?? 'audio'}`);

  const choice = (label: string, active: boolean, onPress: () => void, id?: string) => (
    <TouchableOpacity
      key={label}
      testID={id}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !canEdit }}
      disabled={!canEdit}
      style={[
        styles.choice,
        { borderColor: colors.border },
        active && { backgroundColor: colors.primary, borderColor: colors.primary },
      ]}
      onPress={onPress}
    >
      <Text style={{ color: active ? colors.onPrimary : colors.text, fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      testID={`scene-music-${music.id}`}
    >
      <View style={styles.header}>
        <TouchableOpacity
          testID={`scene-music-open-${music.id}`}
          accessibilityRole="button"
          accessibilityLabel={view.targetName ?? t('scene_music_removed')}
          disabled={view.targetGone}
          style={styles.title}
          onPress={onOpen}
        >
          {view.targetKind ? (
            <Ionicons name={KIND_ICON[view.targetKind]} size={22} color={colors.primary} />
          ) : (
            <Ionicons name="alert-circle-outline" size={22} color={colors.error} />
          )}
          <View style={styles.grow}>
            <Text
              style={[styles.name, { color: view.targetGone ? colors.error : colors.text }]}
              numberOfLines={1}
            >
              {view.targetGone ? t('scene_music_removed') : view.targetName}
            </Text>
            {subtitle ? (
              <Text style={[styles.small, { color: colors.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
        {onListen && !view.targetGone ? (
          <TouchableOpacity
            testID={`scene-music-listen-${music.id}`}
            accessibilityRole="button"
            accessibilityLabel={t(listening ? 'melody_stop' : 'scene_music_listen')}
            style={styles.iconButton}
            onPress={onListen}
          >
            <Ionicons
              name={listening ? 'stop-circle-outline' : 'play-circle-outline'}
              size={32}
              color={colors.primary}
            />
          </TouchableOpacity>
        ) : null}
        {canEdit ? (
          <TouchableOpacity
            testID={`scene-music-menu-${music.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('scene_music_more')}
            style={styles.iconButton}
            onPress={openMenu}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {view.targetGone ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={canEdit ? onReplace : undefined}
          style={[styles.removed, { borderColor: colors.error }]}
        >
          <Text style={[styles.small, { color: colors.textSecondary }]}>
            {t('scene_music_removed_hint')}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View>
        <View style={styles.segmented}>
          {SCENE_MUSIC_ROLES.map((role) =>
            choice(
              t(`scene_music_role_${role === 'in-world' ? 'in_world' : 'score'}`),
              music.role === role,
              () => onRoleChange(role),
              `scene-music-role-${music.id}-${role}`,
            ),
          )}
        </View>
        <Text style={[styles.small, styles.hint, { color: colors.textSecondary }]}>
          {t(`scene_music_role_hint_${music.role === 'in-world' ? 'in_world' : 'score'}`)}
        </Text>
      </View>

      {view.targetKind === 'song' && view.songSections.length > 0 ? (
        <View testID={`scene-music-sections-${music.id}`}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('scene_music_sections_hint')}
          </Text>
          <View style={styles.chips}>
            {[null, ...view.songSections].map((label) => {
              const chosen = music.sections ?? [];
              const active = label === null ? music.sections === null : chosen.includes(label);
              return choice(
                label ?? t('scene_music_sections_whole'),
                active,
                () => {
                  if (label === null) return onSectionsChange(null);
                  const next = chosen.includes(label)
                    ? chosen.filter((item) => item !== label)
                    : [...chosen, label];
                  onSectionsChange(next.length > 0 ? next : null);
                },
                `scene-music-section-${label ?? 'whole'}`,
              );
            })}
          </View>
        </View>
      ) : null}
      {view.missingSections.length > 0 ? (
        <Text
          style={[styles.small, { color: colors.error }]}
          testID={`scene-music-missing-${music.id}`}
        >
          {t('scene_music_sections_missing', { labels: view.missingSections.join(', ') })}
        </Text>
      ) : null}

      <View>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t('scene_music_cue_label')}
        </Text>
        <TextInput
          value={cue}
          onChangeText={(next) => setDraft({ base: music.cue, text: next })}
          onBlur={() => {
            if (cue !== (music.cue ?? '')) onCueCommit(cue);
          }}
          editable={canEdit}
          multiline
          numberOfLines={2}
          placeholder={t('scene_music_cue_placeholder')}
          accessibilityLabel={t('scene_music_cue_label')}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, gap: 12, marginBottom: 14, padding: 14 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  title: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    gap: 10,
    minHeight: TOUCH,
  },
  grow: { flexGrow: 1, flexShrink: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  small: { fontSize: 12, lineHeight: 16 },
  hint: { marginTop: 6 },
  label: { fontSize: 12, marginBottom: 6 },
  iconButton: { alignItems: 'center', height: TOUCH, justifyContent: 'center', width: TOUCH },
  removed: { borderRadius: 6, borderStyle: 'dashed', borderWidth: 1, padding: 8 },
  segmented: { flexDirection: 'row', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
});

export default SceneMusicCard;
