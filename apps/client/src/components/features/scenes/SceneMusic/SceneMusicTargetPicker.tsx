import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useGalleryMedia } from '@/src/hooks/useGalleryMedia';
import type { SceneMusicTarget } from '@/src/services/storymanagement/SceneMusicService';
import { useTheme } from '@/src/theme';

interface SceneMusicTargetPickerProps {
  visible: boolean;
  storyId: string | undefined;
  onClose: () => void;
  onPick: (target: SceneMusicTarget) => void;
}

const REFERENCE_TYPES = ['audio', 'link'] as const;

/** Chooses what a piece of music points at: an audio file or a link of the Gallery. */
const SceneMusicTargetPicker: React.FC<SceneMusicTargetPickerProps> = ({
  visible,
  storyId,
  onClose,
  onPick,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { media, loading } = useGalleryMedia(storyId, visible, REFERENCE_TYPES);

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      contentStyle={[styles.sheet, { backgroundColor: colors.surface }]}
      maxHeight="86%"
    >
      <Text style={[styles.title, { color: colors.text }]}>{t('scene_music_pick_title')}</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : media.length === 0 ? (
        <Text style={{ color: colors.textSecondary }}>{t('scene_music_pick_none')}</Text>
      ) : (
        <ScrollView style={styles.list}>
          {media.map((item) => (
            <TouchableOpacity
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.title ?? item.fileName}
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => onPick({ galleryId: item.id })}
            >
              <Ionicons
                name={item.mediaType === 'link' ? 'link-outline' : 'volume-medium-outline'}
                size={20}
                color={colors.textSecondary}
              />
              <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                {item.title ?? item.fileName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </ResponsiveModal>
  );
};

const styles = StyleSheet.create({
  sheet: { borderRadius: 10, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  list: { maxHeight: 380 },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  rowName: { flex: 1, fontSize: 16 },
});

export default SceneMusicTargetPicker;
