import { getEntityAppearance, readChordProFile } from '@keres/shared';
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
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useScreenHeader } from '../../hooks/useScreenHeader';
import { useSongs } from '../../hooks/useSongs';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { SongStackParamList } from '../../navigation/MainSystemStacks';
import { createSongService } from '../../services/storymanagement/SongService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { pickTextFile } from '../../utils/storyTransfer';

type Navigation = NativeStackNavigationProp<SongStackParamList, 'SongList'>;

/** `G · 90 · 3/4`: the facts a song states, the ones it does not left out. */
export function songFactsLine(song: Pick<SongSelect, 'key' | 'tempo' | 'meter'>): string {
  return [song.key, song.tempo ? String(song.tempo) : null, song.meter].filter(Boolean).join(' · ');
}

/**
 * The songs of the story. A song is made from its title and written in its editor; a ChordPro file
 * from elsewhere comes in as a song of its own. Only the facts the song states are shown: the list
 * never reads the lyrics.
 */
const SongListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Navigation>();
  const db = useDrizzle();
  const storyId = useStoryStore((state) => state.selectedStory?.id);
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

  useScreenHeader({
    target: 'parent',
    title: t('songs_title'),
    actions: [
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
    <View style={styles.container}>
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
