import { SCENE_PAGE_FITS, type ScenePageFit } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { ScenePageView } from '@/src/hooks/useScenePages';
import { useTheme } from '@/src/theme';
import ScenePageThumb from './ScenePageThumb';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

interface ScenePageCardProps {
  view: ScenePageView;
  label: string;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  onTextCommit: (text: string) => void;
  onFitChange: (fit: ScenePageFit) => void;
  onMove: (delta: -1 | 1) => void;
  onReplace: () => void;
  onDelete: () => void;
}

/** One page: its image, its text (saved when you leave the field), its fit, and the ways to move it. */
const ScenePageCard: React.FC<ScenePageCardProps> = ({
  view,
  label,
  isFirst,
  isLast,
  canEdit,
  onTextCommit,
  onFitChange,
  onMove,
  onReplace,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { page } = view;
  // What is being typed, tied to the saved text it started from: once the save lands (or another device
  // changes the text) the saved text wins again, without an effect to copy it over.
  const [draft, setDraft] = useState<{ base: string | null; text: string } | null>(null);
  const text = draft && draft.base === page.text ? draft.text : (page.text ?? '');

  const icon = (name: keyof typeof Ionicons.glyphMap, color = colors.textSecondary) => (
    <Ionicons name={name} size={21} color={color} />
  );

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      testID={`scene-page-${page.id}`}
    >
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {view.isSketch ? (
          <Text style={[styles.badge, { color: colors.textSecondary }]}>
            {t('scene_pages_sketch_badge')}
          </Text>
        ) : null}
        <View style={styles.spacer} />
        {canEdit ? (
          <>
            <TouchableOpacity
              accessibilityLabel={t('scene_pages_move_up')}
              disabled={isFirst}
              style={[styles.iconButton, isFirst && styles.disabled]}
              onPress={() => onMove(-1)}
            >
              {icon('arrow-up-outline')}
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={t('scene_pages_move_down')}
              disabled={isLast}
              style={[styles.iconButton, isLast && styles.disabled]}
              onPress={() => onMove(1)}
            >
              {icon('arrow-down-outline')}
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={t('scene_pages_replace')}
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
      <View style={styles.body}>
        <View style={styles.imageColumn}>
          <ScenePageThumb
            galleryId={view.thumbGalleryId}
            width={120}
            height={120}
            fit={page.fit}
            removed={view.mediaGone}
            label={view.mediaName ?? label}
          />
          {canEdit ? (
            <View style={styles.fits}>
              {SCENE_PAGE_FITS.map((fit) => {
                const active = page.fit === fit;
                return (
                  <TouchableOpacity
                    key={fit}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.fit,
                      { borderColor: colors.border },
                      active && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => onFitChange(fit)}
                  >
                    <Text style={{ color: active ? colors.onPrimary : colors.text, fontSize: 12 }}>
                      {t(`scene_pages_fit_${fit}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>
        <View style={styles.textColumn}>
          {view.mediaGone ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={canEdit ? onReplace : undefined}
              style={[styles.removed, { borderColor: colors.error }]}
            >
              <ThemedText tone="error" style={{ fontWeight: '700' }}>
                {t('scene_pages_media_removed')}
              </ThemedText>
              <ThemedText tone="secondary" style={{ fontSize: 12 }}>
                {t('scene_pages_media_removed_hint')}
              </ThemedText>
            </TouchableOpacity>
          ) : view.mediaName ? (
            <ThemedText tone="secondary" style={{ fontSize: 12 }} numberOfLines={1}>
              {view.mediaName}
            </ThemedText>
          ) : null}
          <TextInput
            value={text}
            onChangeText={(next) => setDraft({ base: page.text, text: next })}
            onBlur={() => {
              if (text !== (page.text ?? '')) onTextCommit(text);
            }}
            editable={canEdit}
            multiline
            numberOfLines={4}
            placeholder={t('scene_pages_text_placeholder')}
            accessibilityLabel={`${label}: ${t('scene_pages_text_placeholder')}`}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, gap: 10, marginBottom: 12, padding: 12 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  label: { fontSize: 16, fontWeight: '700' },
  badge: { fontSize: 12 },
  spacer: { flex: 1 },
  iconButton: { padding: 6 },
  disabled: { opacity: 0.3 },
  body: { flexDirection: 'row', gap: 12 },
  imageColumn: { gap: 8, width: 120 },
  fits: { flexDirection: 'row', gap: 4 },
  fit: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  textColumn: { flexGrow: 1, flexShrink: 1, gap: 6 },
  removed: { borderRadius: 6, borderStyle: 'dashed', borderWidth: 1, gap: 2, padding: 8 },
});

export default ScenePageCard;
