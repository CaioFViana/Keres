import { SONG_LANGUAGES, SONG_PLACEMENTS, SONG_REPEATS } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { useTheme } from '@/src/theme';
import type { ManuscriptExportSettings, withChange } from '../export/manuscriptExportSettings';
import { OptionPills, OptionSection, SwitchRow } from './ExportOptionRows';

interface SongsOptionsProps {
  settings: ManuscriptExportSettings;
  change: (patch: Parameters<typeof withChange>[1]) => void;
  /** A script prints a song where it is sung, in Fountain lyrics: there is no appendix and no chords. */
  script: boolean;
}

/**
 * What an export asks about the songs the scenes sing: whether to print them at all (off unless
 * asked), where, in which words, and whether a part already printed is printed again. The words are
 * the song's own - a recording or a link of the Gallery is never part of an export.
 */
const SongsOptions: React.FC<SongsOptionsProps> = ({ settings, change, script }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const placeInScene = script || settings.songsPlacement === 'after-scene';
  return (
    <>
      <OptionSection title={t('export_songs_section')} />
      <SwitchRow
        testID="export-songs"
        label={t('export_songs_include')}
        value={settings.includeSongs}
        onChange={(includeSongs) => change({ includeSongs })}
      />
      <Text style={{ color: colors.textSecondary, lineHeight: 19, marginTop: 4 }}>
        {t('export_songs_hint')}
      </Text>
      {settings.includeSongs ? (
        <>
          {script ? null : (
            <OptionPills
              label={t('export_songs_placement')}
              testID="export-songs-placement"
              value={settings.songsPlacement}
              onChange={(songsPlacement) => change({ songsPlacement })}
              options={SONG_PLACEMENTS.map((value) => ({
                value,
                label: t(`export_songs_placement_${value.replace('-', '_')}`),
              }))}
            />
          )}
          <OptionPills
            label={t('export_songs_language')}
            testID="export-songs-language"
            value={settings.songLanguage}
            onChange={(songLanguage) => change({ songLanguage })}
            options={SONG_LANGUAGES.map((value) => ({
              value,
              label: t(`export_songs_language_${value}`),
            }))}
          />
          {placeInScene ? (
            <OptionPills
              label={t('export_songs_repeat')}
              testID="export-songs-repeat"
              value={settings.songRepeat}
              onChange={(songRepeat) => change({ songRepeat })}
              options={SONG_REPEATS.map((value) => ({
                value,
                label: t(`export_songs_repeat_${value.replace('-', '_')}`),
              }))}
            />
          ) : null}
          {script ? null : (
            <SwitchRow
              testID="export-songs-chords"
              label={t('export_songs_chords')}
              value={settings.songChords}
              onChange={(songChords) => change({ songChords })}
            />
          )}
        </>
      ) : null}
    </>
  );
};

export default SongsOptions;
