import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useGalleryMedia } from '@/src/hooks/useGalleryMedia';
import { useSongs } from '@/src/hooks/useSongs';
import type { SceneMusicTarget } from '@/src/services/storymanagement/SceneMusicService';
import { useTheme } from '@/src/theme';
import { scenePickerStyleDefs } from '../scenePickerStyleDefs';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';

interface SceneMusicTargetPickerProps {
  visible: boolean;
  storyId: string | undefined;
  onClose: () => void;
  onPick: (target: SceneMusicTarget) => void;
  /** Opens the story's songs, to write a new one; absent where that is not offered. */
  onOpenSongs?: () => void;
}

type Tab = 'songs' | 'gallery';

/** `G · 90 · 3/4`: the facts a song states, to tell two songs apart in a list. */
const songFacts = (song: { key: string | null; tempo: number | null; meter: string | null }) =>
  [song.key, song.tempo ? String(song.tempo) : null, song.meter].filter(Boolean).join(' · ');

const REFERENCE_TYPES = ['audio', 'link'] as const;

/**
 * Chooses what a piece of music points at: a song of the story, or an audio file or a link of the
 * Gallery. Each list is read only while its tab is the one in view.
 */
const SceneMusicTargetPicker: React.FC<SceneMusicTargetPickerProps> = ({
  visible,
  storyId,
  onClose,
  onPick,
  onOpenSongs,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('songs');
  const gallery = useGalleryMedia(storyId, visible && tab === 'gallery', REFERENCE_TYPES);
  const { songs, loading: loadingSongs } = useSongs(
    visible && tab === 'songs' ? storyId : undefined,
  );

  const tabStyle = (active: boolean) => [
    styles.tab,
    { borderColor: colors.border },
    active && { backgroundColor: colors.primary, borderColor: colors.primary },
  ];

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      tone="raised"
      inset="roomy"
      maxHeight="86%"
    >
      <ModalHeader title={t('scene_music_pick_title')} />
      <View style={styles.tabs}>
        {(['songs', 'gallery'] as const).map((name) => (
          <TouchableOpacity
            key={name}
            testID={`scene-music-tab-${name}`}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === name }}
            style={tabStyle(tab === name)}
            onPress={() => setTab(name)}
          >
            <Text style={{ color: tab === name ? colors.onPrimary : colors.text }}>
              {t(`scene_music_pick_${name}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'songs' ? (
        loadingSongs ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            {songs.length === 0 ? (
              <ThemedText tone="secondary">{t('scene_music_pick_no_songs')}</ThemedText>
            ) : (
              <ScrollView style={styles.list}>
                {songs.map((song) => (
                  <TouchableOpacity
                    key={song.id}
                    accessibilityRole="button"
                    accessibilityLabel={song.title}
                    style={[styles.row, { borderBottomColor: colors.border }]}
                    onPress={() => onPick({ songId: song.id })}
                  >
                    <Ionicons name="musical-notes-outline" size={20} color={colors.textSecondary} />
                    <View style={styles.rowText}>
                      <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                        {song.title}
                      </Text>
                      {songFacts(song) ? (
                        <Text style={[styles.rowFacts, { color: colors.textSecondary }]}>
                          {songFacts(song)}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {onOpenSongs ? (
              <TouchableOpacity
                testID="scene-music-open-songs"
                accessibilityRole="button"
                onPress={onOpenSongs}
                style={styles.manage}
              >
                <ThemedText tone="primary">{t('scene_music_manage_songs')}</ThemedText>
              </TouchableOpacity>
            ) : null}
          </>
        )
      ) : gallery.loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : gallery.media.length === 0 ? (
        <ThemedText tone="secondary">{t('scene_music_pick_none')}</ThemedText>
      ) : (
        <ScrollView style={styles.list}>
          {gallery.media.map((item) => (
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
  ...scenePickerStyleDefs,
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
    paddingVertical: 10,
  },
  rowText: { flex: 1 },
  rowName: { fontSize: 16 },
  rowFacts: { fontSize: 12, marginTop: 2 },
  manage: { paddingTop: 12 },
});

export default SceneMusicTargetPicker;
