import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_METER, DEFAULT_TEMPO } from '@keres/shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';
import SongFactsFields from './SongFactsFields';

interface MusicalDetailsProps {
  keyValue: string | null | undefined;
  tempo: number | null | undefined;
  meter: string | null | undefined;
  editable: boolean;
  onKeyChange: (key: string | null) => void;
  onTempoChange: (tempo: number | null) => void;
  onMeterChange: (meter: string | null) => void;
}

/**
 * The key, the tempo and the meter, folded away behind what they come to ("90 bpm · 4/4"). A song that
 * is only words needs none of them, and a person who has never heard the words does not have to meet
 * them before the lyrics; whoever writes a tune opens them to set the speed and the beat.
 */
const MusicalDetails: React.FC<MusicalDetailsProps> = ({ keyValue, tempo, meter, ...rest }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const summary = [
    keyValue || null,
    t('song_details_bpm', { tempo: tempo ?? DEFAULT_TEMPO }),
    meter ?? DEFAULT_METER,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.container}>
      <TouchableOpacity
        testID="song-details-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.toggle}
        onPress={() => setOpen((current) => !current)}
      >
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.text} />
        <Text style={[styles.title, { color: colors.text }]}>{t('song_details_title')}</Text>
        <Text
          style={[styles.summary, { color: colors.textSecondary }]}
          testID="song-details-summary"
        >
          {summary}
        </Text>
      </TouchableOpacity>
      {open ? <SongFactsFields keyValue={keyValue} tempo={tempo} meter={meter} {...rest} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 6 },
  toggle: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 44 },
  title: { fontSize: 15, fontWeight: '700' },
  summary: { flexShrink: 1, fontSize: 13 },
});

export default MusicalDetails;
