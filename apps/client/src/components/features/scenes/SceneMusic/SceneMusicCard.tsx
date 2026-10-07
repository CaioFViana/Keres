import { SCENE_MUSIC_ROLES, type SceneMusicRole } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { SceneMusicView } from '@/src/hooks/useSceneMusic';
import { useTheme } from '@/src/theme';

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
}

const KIND_ICON = {
  song: 'musical-notes-outline',
  audio: 'volume-medium-outline',
  link: 'link-outline',
} as const;

/** One piece of music: what it is, whether the story hears it, when it comes in, and its place. */
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
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { music } = view;
  // What is being typed, tied to the saved cue it started from: once the save lands (or another device
  // changes the cue) the saved cue wins again, without an effect to copy it over.
  const [draft, setDraft] = useState<{ base: string | null; text: string } | null>(null);
  const cue = draft && draft.base === music.cue ? draft.text : (music.cue ?? '');

  const icon = (name: keyof typeof Ionicons.glyphMap, color = colors.textSecondary) => (
    <Ionicons name={name} size={21} color={color} />
  );

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      testID={`scene-music-${music.id}`}
    >
      <View style={styles.header}>
        {view.targetKind ? icon(KIND_ICON[view.targetKind]) : null}
        {view.targetGone ? (
          <Text style={[styles.name, { color: colors.error }]} numberOfLines={1}>
            {t('scene_music_removed')}
          </Text>
        ) : (
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {view.targetName}
          </Text>
        )}
        {canEdit ? (
          <>
            <TouchableOpacity
              accessibilityLabel={t('scene_music_move_up')}
              disabled={isFirst}
              style={[styles.iconButton, isFirst && styles.disabled]}
              onPress={() => onMove(-1)}
            >
              {icon('arrow-up-outline')}
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={t('scene_music_move_down')}
              disabled={isLast}
              style={[styles.iconButton, isLast && styles.disabled]}
              onPress={() => onMove(1)}
            >
              {icon('arrow-down-outline')}
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={t('scene_music_change')}
              style={styles.iconButton}
              onPress={onReplace}
            >
              {icon('swap-horizontal-outline')}
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={t('delete')}
              style={styles.iconButton}
              onPress={onDelete}
            >
              {icon('trash-outline', colors.error)}
            </TouchableOpacity>
          </>
        ) : null}
      </View>
      {view.targetGone ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={canEdit ? onReplace : undefined}
          style={[styles.removed, { borderColor: colors.error }]}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {t('scene_music_removed_hint')}
          </Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.roles}>
        {SCENE_MUSIC_ROLES.map((role) => {
          const active = music.role === role;
          return (
            <TouchableOpacity
              key={role}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: !canEdit }}
              disabled={!canEdit}
              style={[
                styles.role,
                { borderColor: colors.border },
                active && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => onRoleChange(role)}
            >
              <Text style={{ color: active ? colors.onPrimary : colors.text, fontSize: 12 }}>
                {t(`scene_music_role_${role === 'in-world' ? 'in_world' : 'score'}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.roleHint, { color: colors.textSecondary }]}>
        {t(`scene_music_role_hint_${music.role === 'in-world' ? 'in_world' : 'score'}`)}
      </Text>
      {view.targetKind === 'song' && view.songSections.length > 0 ? (
        <View testID={`scene-music-sections-${music.id}`}>
          <Text style={[styles.roleHint, { color: colors.textSecondary }]}>
            {t('scene_music_sections_hint')}
          </Text>
          <View style={styles.roles}>
            {[null, ...view.songSections].map((label) => {
              const chosen = music.sections ?? [];
              const active = label === null ? music.sections === null : chosen.includes(label);
              return (
                <TouchableOpacity
                  key={label ?? 'whole'}
                  testID={`scene-music-section-${label ?? 'whole'}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: !canEdit }}
                  disabled={!canEdit}
                  style={[
                    styles.role,
                    { borderColor: colors.border },
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => {
                    if (label === null) return onSectionsChange(null);
                    const next = chosen.includes(label)
                      ? chosen.filter((item) => item !== label)
                      : [...chosen, label];
                    onSectionsChange(next.length > 0 ? next : null);
                  }}
                >
                  <Text style={{ color: active ? colors.onPrimary : colors.text, fontSize: 12 }}>
                    {label ?? t('scene_music_sections_whole')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
      {view.missingSections.length > 0 ? (
        <Text
          style={{ color: colors.error, fontSize: 12 }}
          testID={`scene-music-missing-${music.id}`}
        >
          {t('scene_music_sections_missing', { labels: view.missingSections.join(', ') })}
        </Text>
      ) : null}
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
        accessibilityLabel={t('scene_music_cue_placeholder')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, gap: 8, marginBottom: 12, padding: 12 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  name: { flexGrow: 1, flexShrink: 1, fontSize: 16, fontWeight: '700' },
  iconButton: { padding: 6 },
  disabled: { opacity: 0.3 },
  removed: { borderRadius: 6, borderStyle: 'dashed', borderWidth: 1, padding: 8 },
  roles: { flexDirection: 'row', gap: 6 },
  role: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  roleHint: { fontSize: 12, lineHeight: 16 },
});

export default SceneMusicCard;
