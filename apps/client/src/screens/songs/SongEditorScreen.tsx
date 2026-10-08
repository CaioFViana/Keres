import {
  buildBacking,
  DEFAULT_SECTION_WORDS,
  buildTimeline,
  defaultFeel,
  chordProFileOf,
  MAX_SONG_NOTES_LENGTH,
  MAX_SONG_TITLE_LENGTH,
  MAX_SONG_TRANSLATION_LENGTH,
  parseChordPro,
  parseMelody,
  transposedSpelling,
  transposeLyrics,
  transposeMelody,
  writeAbc,
  writeMidi,
} from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import MelodyPanel from '@/src/components/features/songs/MelodyPanel';
import SongTabs, { type SongTab } from '@/src/components/features/songs/SongTabs';
import SongFactsFields from '@/src/components/features/songs/SongFactsFields';
import SongLyricsEditor from '@/src/components/features/songs/SongLyricsEditor';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import { useDrizzle } from '../../db';
import { useScreenAnchor } from '../../guides/useGuideAnchor';
import { useNavigateAcrossStacks } from '../../hooks/useNavigateAcrossStacks';
import { useScreenTour } from '../../guides/useScreenTour';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useOpenGalleryMediaViewer } from '../../hooks/useOpenGalleryMediaViewer';
import { useScreenHeader } from '../../hooks/useScreenHeader';
import { useSong, useSongUses } from '../../hooks/useSongs';
import { useSongDraft } from '../../hooks/useSongDraft';
import { useNewSectionWords } from '../../hooks/useNewSectionWords';
import { type PlaybackVoice, useSongPlayback } from '../../hooks/useSongPlayback';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { SongStackParamList } from '../../navigation/MainSystemStacks';
import { createSongService } from '../../services/storymanagement/SongService';
import { useNotificationStore } from '../../state/notificationStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { deliverFile } from '../../utils/storyTransfer';

type RouteProps = RouteProp<SongStackParamList, 'SongEditor'>;

/** A file name from a title: its letters and digits, joined by dashes. */
export function songFileName(title: string, extension = 'cho'): string {
  const base = title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return `${base || 'song'}.${extension}`;
}

/**
 * A song, written: its title, its key, tempo and meter, its lyrics with their chords (and the sheet
 * they make), their translation, its notes and the media kept with it. What is typed is a draft and
 * is saved when the person pauses, leaves a field or the screen - never per keystroke.
 */
const SongEditorScreen = () => {
  useBackButtonHandler();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const navigateAcross = useNavigateAcrossStacks();
  const { songId } = useRoute<RouteProps>().params;
  const db = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const confirmDelete = useConfirmDelete();
  const openMedia = useOpenGalleryMediaViewer();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const song = useSong(songId);
  const { canEdit } = useStoryRole(song?.storyId);
  const draft = useSongDraft(song);
  const uses = useSongUses(songId, song?.storyId);
  const syllableLanguage = i18n.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  // Sections are read by one set of words whatever language the app is in; the other set only names
  // a section when it is added, and is written out in the text.
  const words = DEFAULT_SECTION_WORDS;
  const newSectionWords = useNewSectionWords();
  const [tab, setTab] = useState<SongTab>('words');
  useScreenTour('SongEditor', canEdit);
  // The tune has its own tour, opened the first time the tab is: that is where the sound is.
  useScreenTour('SongTune', tab === 'tune');
  const tabsAnchorRef = useScreenAnchor('SongEditor', 'tabs');
  const wordsAnchorRef = useScreenAnchor('SongEditor', 'words');

  const lyrics = draft.value('lyrics') ?? '';
  const title = draft.value('title') ?? '';
  const melody = draft.value('melody') ?? '';
  const playback = useSongPlayback({
    lyrics,
    melody,
    tempo: draft.value('tempo') ?? null,
    meter: draft.value('meter') ?? null,
    words,
    language: syllableLanguage,
  });

  // What the song was before each transposition, so a step too far can be taken back. Anything
  // written by hand afterwards ends it: restoring would erase that writing.
  const undoStack = useRef<{ lyrics: string; melody: string; key: string | null }[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  const forgetTransposition = useCallback(() => {
    if (undoStack.current.length === 0) return;
    undoStack.current = [];
    setUndoDepth(0);
  }, []);

  const transpose = useCallback(
    (semitones: number) => {
      undoStack.current.push({ lyrics, melody, key: draft.value('key') ?? null });
      setUndoDepth(undoStack.current.length);
      const spelling = transposedSpelling(draft.value('key') ?? null, semitones);
      draft.setField('lyrics', transposeLyrics(lyrics, semitones, spelling.preferFlats));
      // The tune moves with the chords, or they would no longer fit it.
      if (melody !== '') {
        draft.setField('melody', transposeMelody(melody, semitones, spelling.preferFlats));
      }
      if (spelling.key) draft.setField('key', spelling.key);
    },
    [draft, lyrics, melody],
  );

  const undoTransposition = useCallback(() => {
    const before = undoStack.current.pop();
    setUndoDepth(undoStack.current.length);
    if (!before) return;
    draft.setField('lyrics', before.lyrics);
    draft.setField('melody', before.melody === '' ? null : before.melody);
    draft.setField('key', before.key);
  }, [draft]);

  const exportFile = useCallback(async () => {
    if (!song) return;
    try {
      await draft.flush();
      const text = chordProFileOf({
        title: draft.value('title') ?? song.title,
        key: draft.value('key') ?? null,
        tempo: draft.value('tempo') ?? null,
        meter: draft.value('meter') ?? null,
        lyrics: draft.value('lyrics') ?? '',
      });
      const result = await deliverFile(
        text,
        songFileName(song.title),
        'text/plain',
        'public.plain-text',
      );
      if (!result.delivered) {
        showNotification(t('export_story_no_share_target', { path: result.uri }), 'warning');
      }
    } catch (error) {
      console.log('SongEditorScreen: failed to export the song.', error);
      showNotification(t('song_export_failed'), 'error');
    }
  }, [draft, showNotification, song, t]);

  const exportTune = useCallback(
    async (kind: 'midi' | 'abc', voice?: PlaybackVoice) => {
      if (!song) return;
      try {
        await draft.flush();
        const parsedSong = parseChordPro(lyrics, words);
        const parsedTune = parseMelody(melody);
        const heading = draft.value('title') ?? song.title;
        const facts = {
          tempo: draft.value('tempo') ?? null,
          meter: draft.value('meter') ?? null,
          language: syllableLanguage,
        } as const;
        // The accompaniment chosen goes into the MIDI file, for a player with better sounds than ours.
        const timeline = buildTimeline(parsedSong, parsedTune, facts);
        const instrument = voice?.instrument ?? null;
        const backingNotes = instrument
          ? buildBacking(timeline.chords, {
              instrument,
              feel: voice?.feel && voice.feel !== 'auto' ? voice.feel : defaultFeel(timeline.meter),
              meter: timeline.meter,
            })
          : [];
        const backing =
          instrument && backingNotes.length > 0 ? { instrument, notes: backingNotes } : undefined;
        const result =
          kind === 'midi'
            ? await deliverFile(
                writeMidi(timeline, { title: heading, ...(backing ? { backing } : {}) }),
                songFileName(heading, 'mid'),
                'audio/midi',
                'public.midi-audio',
              )
            : await deliverFile(
                writeAbc(parsedSong, parsedTune, {
                  ...facts,
                  title: heading,
                  key: draft.value('key') ?? null,
                  preferFlats: transposedSpelling(draft.value('key') ?? null, 0).preferFlats,
                }),
                songFileName(heading, 'abc'),
                'text/vnd.abc',
                'public.plain-text',
              );
        if (!result.delivered) {
          showNotification(t('export_story_no_share_target', { path: result.uri }), 'warning');
        }
      } catch (error) {
        console.log('SongEditorScreen: failed to export the tune.', error);
        showNotification(t('song_export_failed'), 'error');
      }
    },
    [draft, lyrics, melody, showNotification, song, syllableLanguage, t, words],
  );

  useScreenHeader({
    target: 'parent',
    title: song?.title ?? t('songs_title'),
    actions: [
      {
        id: 'export-song',
        icon: 'share-outline',
        label: t('song_export'),
        onPress: () => void exportFile(),
        visible: !!song,
      },
      {
        id: 'delete-song',
        icon: 'trash-outline',
        label: t('delete'),
        onPress: () =>
          confirmDelete({
            titleKey: 'song_delete_title',
            messageKey: 'song_delete_message',
            onConfirm: async () => {
              if (userId) await createSongService(db).deleteSong(userId, songId);
              navigation.goBack();
            },
            failureKey: 'song_save_failed',
          }),
        visible: !!canEdit && !!song,
      },
    ],
  });

  if (song === undefined) return <ScreenLoading padded message={t('loading')} />;
  if (song === null) {
    return (
      <ScreenError padded message={t('song_not_found')} onGoBack={() => navigation.goBack()} />
    );
  }

  const container = getCommonContainerStyles(colors).container;
  const editable = !!canEdit;
  const styles = StyleSheet.create({
    label: { color: colors.text, fontSize: 15, marginBottom: 6, marginTop: 14 },
    hint: { color: colors.textSecondary, fontSize: 12, marginBottom: 6 },
    error: { color: colors.error, marginTop: 8 },
    use: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    useName: { color: colors.primary, fontSize: 15 },
  });

  const openScene = (sceneId: string) =>
    navigateAcross('NarrativeElementsStack', 'SceneDetail', { sceneId });

  return (
    <KeyboardAwareScreen
      style={container}
      contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
    >
      <Text style={styles.label}>{t('song_title')}</Text>
      <TextInput
        testID="song-title"
        accessibilityLabel={t('song_title')}
        value={title}
        editable={editable}
        maxLength={MAX_SONG_TITLE_LENGTH}
        onChangeText={(next) => draft.setField('title', next)}
        onBlur={() => void draft.flush()}
      />

      <SongFactsFields
        keyValue={draft.value('key')}
        tempo={draft.value('tempo')}
        meter={draft.value('meter')}
        editable={editable}
        onKeyChange={(next) => draft.setField('key', next)}
        onTempoChange={(next) => draft.setField('tempo', next)}
        onMeterChange={(next) => draft.setField('meter', next)}
      />

      <View ref={tabsAnchorRef} collapsable={false}>
        <SongTabs value={tab} onChange={setTab} />
      </View>

      {tab === 'words' ? (
        <>
          <View ref={wordsAnchorRef} collapsable={false}>
            <SongLyricsEditor
              value={lyrics}
              onChange={(next) => {
                forgetTransposition();
                draft.setField('lyrics', next);
              }}
              onTranspose={transpose}
              canUndoTranspose={undoDepth > 0}
              onUndoTranspose={undoTransposition}
              editable={editable}
              words={words}
              newSectionWords={newSectionWords}
              syllableLanguage={syllableLanguage}
              activeLine={playback.active}
            />
          </View>

          <Text style={styles.label}>{t('song_translation')}</Text>
          <Text style={styles.hint}>{t('song_translation_hint')}</Text>
          <TextInput
            testID="song-translation"
            accessibilityLabel={t('song_translation')}
            value={draft.value('lyricsTranslation') ?? ''}
            editable={editable}
            multiline
            numberOfLines={5}
            maxLength={MAX_SONG_TRANSLATION_LENGTH}
            autoCorrect={false}
            onChangeText={(next) => draft.setField('lyricsTranslation', next)}
            onBlur={() => void draft.flush()}
          />
        </>
      ) : null}

      {tab === 'tune' ? (
        <MelodyPanel
          lyrics={lyrics}
          melody={melody}
          songKey={draft.value('key') ?? null}
          tempo={draft.value('tempo') ?? null}
          meter={draft.value('meter') ?? null}
          editable={editable}
          words={words}
          language={syllableLanguage}
          onChange={(next) => {
            forgetTransposition();
            draft.setField('melody', next);
          }}
          onBlur={() => void draft.flush()}
          phase={playback.phase}
          progress={playback.progress}
          problem={playback.problem}
          active={playback.active}
          onPlay={(scope, voice) => void playback.play(scope, voice)}
          onStop={playback.stop}
          onTone={(pitch, timbre) => void playback.playTone(pitch, timbre)}
          onExport={(kind, voice) => void exportTune(kind, voice)}
        />
      ) : null}

      {tab === 'details' ? (
        <>
          <Text style={styles.label}>{t('song_notes')}</Text>
          <Text style={styles.hint}>{t('song_notes_hint')}</Text>
          <TextInput
            testID="song-notes"
            accessibilityLabel={t('song_notes')}
            value={draft.value('notes') ?? ''}
            editable={editable}
            multiline
            numberOfLines={4}
            maxLength={MAX_SONG_NOTES_LENGTH}
            onChangeText={(next) => draft.setField('notes', next)}
            onBlur={() => void draft.flush()}
          />

          <ScreenSection title={t('song_scenes')} />
          {uses.length === 0 ? (
            <Text style={styles.hint}>{t('song_scenes_none')}</Text>
          ) : (
            <View>
              {uses.map((use) => (
                <TouchableOpacity
                  key={use.sceneId}
                  accessibilityRole="button"
                  style={styles.use}
                  onPress={() => openScene(use.sceneId)}
                >
                  <Text style={styles.useName}>{use.sceneName}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <ScreenSection title={t('media_section_title')} />
          <EntityGalleryManager
            ownerId={songId}
            ownerType="Song"
            onPressMedia={openMedia}
            editable={editable}
          />
        </>
      ) : null}

      {draft.error ? (
        <Text style={styles.error} testID="song-save-error">
          {t('song_save_failed')}
        </Text>
      ) : null}
    </KeyboardAwareScreen>
  );
};

export default SongEditorScreen;
