import {
  type CueSheetLabels,
  cueSheetCsv,
  cueSheetMarkdown,
  getEntityAppearance,
  readChordProFile,
} from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import SongCreateModal from '@/src/components/features/songs/SongCreateModal';
import { useDrizzle } from '../../db';
import type { SongSelect } from '../../db/schema';
import { useScreenAnchor } from '../../guides/useGuideAnchor';
import { useScreenTour } from '../../guides/useScreenTour';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useScreenHeader } from '../../hooks/useScreenHeader';
import { useSongs } from '../../hooks/useSongs';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { SongStackParamList } from '../../navigation/MainSystemStacks';
import { loadCueSheet } from '../../services/storymanagement/CueSheetService';
import { createSongService } from '../../services/storymanagement/SongService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { deliverFile, pickTextFile } from '../../utils/storyTransfer';

type Navigation = NativeStackNavigationProp<SongStackParamList, 'SongList'>;

/** `G · 90 · 3/4`: the facts a song states, the ones it does not left out. */
export function songFactsLine(song: Pick<SongSelect, 'key' | 'tempo' | 'meter'>): string {
  return [song.key, song.tempo ? String(song.tempo) : null, song.meter].filter(Boolean).join(' · ');
}

/** A file name from the title of the story: its letters and digits, joined by dashes. */
export function cueSheetFileName(title: string, extension: 'csv' | 'md'): string {
  const base = title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return `${base || 'story'}-cue-sheet.${extension}`;
}

/**
 * The songs of the story. A song is made from its title and written in its editor; a ChordPro file
 * from elsewhere comes in as a song of its own. Only the facts the song states are shown: the list
 * never reads the lyrics.
 */
const SongListScreen = () => {
  useBackButtonHandler();
  useScreenTour('SongStack');
  const listAnchorRef = useScreenAnchor('Songs', 'list');
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Navigation>();
  const db = useDrizzle();
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const storyTitle = useStoryStore((state) => state.selectedStory?.title);
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const { canEdit } = useStoryRole(storyId);
  const { songs, loading } = useSongs(storyId);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const shown = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? songs.filter((song) => song.title.toLocaleLowerCase().includes(query)) : songs;
  }, [search, songs]);

  const open = useCallback(
    (songId: string) => navigation.navigate('SongEditor', { songId }),
    [navigation],
  );

  const create = useCallback(
    async (title: string) => {
      setCreating(false);
      if (!userId || !storyId) return;
      try {
        const song = await createSongService(db).createSong(userId, { storyId, title });
        open(song.id);
      } catch (error) {
        console.log('SongListScreen: failed to create a song.', error);
        showNotification(t('song_save_failed'), 'error');
      }
    },
    [db, open, showNotification, storyId, t, userId],
  );

  const importFile = useCallback(async () => {
    if (!userId || !storyId) return;
    try {
      const picked = await pickTextFile();
      if (!picked) return;
      const fallbackTitle = picked.name.replace(/\.[^.]+$/, '');
      const file = readChordProFile(picked.text, fallbackTitle);
      const song = await createSongService(db).createSong(userId, {
        storyId,
        title: file.title || t('song_untitled'),
        lyrics: file.lyrics,
        key: file.key,
        tempo: file.tempo,
        meter: file.meter,
      });
      showNotification(t('song_import_done', { title: song.title }), 'success');
      open(song.id);
    } catch (error) {
      console.log('SongListScreen: failed to import a ChordPro file.', error);
      showNotification(t('song_import_failed'), 'error');
    }
  }, [db, open, showNotification, storyId, t, userId]);

  const exportCueSheet = useCallback(
    async (kind: 'csv' | 'md') => {
      if (!storyId) return;
      try {
        const language = i18n.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
        const rows = await loadCueSheet(db, storyId, language);
        if (rows.length === 0) {
          showNotification(t('cue_sheet_empty'), 'info');
          return;
        }
        const labels: CueSheetLabels = {
          title: t('cue_sheet_title'),
          scene: t('cue_sheet_scene'),
          chapter: t('cue_sheet_chapter'),
          cue: t('cue_sheet_cue'),
          role: t('cue_sheet_role'),
          music: t('cue_sheet_music'),
          reference: t('cue_sheet_reference'),
          key: t('song_key'),
          tempo: t('song_tempo'),
          meter: t('song_meter'),
          duration: t('cue_sheet_duration'),
          sections: t('cue_sheet_sections'),
          lyrics: t('cue_sheet_lyrics'),
          inWorld: t('scene_music_role_in_world'),
          score: t('scene_music_role_score'),
          gone: t('cue_sheet_gone'),
        };
        const name = cueSheetFileName(storyTitle ?? '', kind);
        const result =
          kind === 'csv'
            ? await deliverFile(
                cueSheetCsv(rows, labels),
                name,
                'text/csv',
                'public.comma-separated-values-text',
              )
            : await deliverFile(
                cueSheetMarkdown(rows, labels),
                name,
                'text/markdown',
                'net.daringfireball.markdown',
              );
        if (!result.delivered) {
          showNotification(t('export_story_no_share_target', { path: result.uri }), 'warning');
        }
      } catch (error) {
        console.log('SongListScreen: failed to make the cue sheet.', error);
        showNotification(t('cue_sheet_failed'), 'error');
      }
    },
    [db, i18n.language, showNotification, storyId, storyTitle, t],
  );

  useScreenHeader({
    target: 'parent',
    title: t('songs_title'),
    actions: [
      {
        id: 'cue-sheet-csv',
        icon: 'grid-outline',
        label: t('cue_sheet_csv'),
        onPress: () => void exportCueSheet('csv'),
        visible: true,
      },
      {
        id: 'cue-sheet-md',
        icon: 'document-text-outline',
        label: t('cue_sheet_md'),
        onPress: () => void exportCueSheet('md'),
        visible: true,
      },
      {
        id: 'import-song',
        icon: 'download-outline',
        label: t('song_import'),
        onPress: () => void importFile(),
        visible: !!canEdit,
      },
      {
        id: 'add-song',
        icon: 'add',
        label: t('song_add'),
        onPress: () => setCreating(true),
        visible: !!canEdit,
      },
    ],
  });

  if (loading) return <ScreenLoading padded message={t('loading')} />;

  const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    row: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      marginBottom: 10,
      padding: 12,
    },
    name: { color: colors.text, flexShrink: 1, fontSize: 16, fontWeight: '700' },
    facts: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
    empty: { color: colors.textSecondary, marginVertical: 32, textAlign: 'center' },
  });

  return (
    <View style={styles.container} ref={listAnchorRef} collapsable={false}>
      <TextInput
        testID="song-search"
        accessibilityLabel={t('songs_search')}
        value={search}
        onChangeText={setSearch}
        placeholder={t('songs_search')}
      />
      <FlatList
        data={shown}
        keyExtractor={(song) => song.id}
        contentContainerStyle={{ paddingTop: 12 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {t(songs.length === 0 ? 'songs_empty' : 'songs_no_match')}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`song-row-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            style={styles.row}
            onPress={() => open(item.id)}
          >
            <Ionicons
              name={getEntityAppearance('Song').icon as keyof typeof Ionicons.glyphMap}
              size={22}
              color={colors.primary}
            />
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.title}
              </Text>
              {songFactsLine(item) ? <Text style={styles.facts}>{songFactsLine(item)}</Text> : null}
            </View>
          </TouchableOpacity>
        )}
      />
      <SongCreateModal
        visible={creating}
        onCancel={() => setCreating(false)}
        onConfirm={(title) => void create(title)}
      />
    </View>
  );
};

export default SongListScreen;
