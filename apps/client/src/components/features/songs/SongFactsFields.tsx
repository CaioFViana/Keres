import { MAX_SONG_TEMPO, MIN_SONG_TEMPO } from '@keres/shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useTheme } from '@/src/theme';

/** The meters offered at a touch; anything else the lyrics can still carry in their own words. */
export const SONG_METERS = ['2/4', '3/4', '4/4', '6/8', '12/8'] as const;

interface SongFactsFieldsProps {
  keyValue: string | null | undefined;
  tempo: number | null | undefined;
  meter: string | null | undefined;
  editable: boolean;
  onKeyChange: (key: string | null) => void;
  onTempoChange: (tempo: number | null) => void;
  onMeterChange: (meter: string | null) => void;
}

const KEY_PATTERN = /^[A-G][#b]?(m|min|minor|maj|major)?$/;

/**
 * The key, the tempo and the meter of a song: the three facts a player needs. Each is committed
 * only when it makes sense (a key that is a key, a tempo in range) and the field says so when it
 * does not, rather than saving something the server would refuse.
 */
const SongFactsFields: React.FC<SongFactsFieldsProps> = ({
  keyValue,
  tempo,
  meter,
  editable,
  onKeyChange,
  onTempoChange,
  onMeterChange,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // What is being typed in the two text fields, until it is a value worth keeping.
  const [keyDraft, setKeyDraft] = useState<string | null>(null);
  const [tempoDraft, setTempoDraft] = useState<string | null>(null);
  const keyText = keyDraft ?? keyValue ?? '';
  const tempoText = tempoDraft ?? (tempo ? String(tempo) : '');
  const keyInvalid = keyText.trim() !== '' && !KEY_PATTERN.test(keyText.trim());
  const tempoNumber = Number.parseInt(tempoText, 10);
  const tempoInvalid =
    tempoText.trim() !== '' &&
    !(
      Number.isInteger(tempoNumber) &&
      tempoNumber >= MIN_SONG_TEMPO &&
      tempoNumber <= MAX_SONG_TEMPO
    );

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>{t('song_key')}</Text>
          <TextInput
            testID="song-key"
            accessibilityLabel={t('song_key')}
            value={keyText}
            editable={editable}
            autoCapitalize="characters"
            maxLength={12}
            placeholder="G"
            onChangeText={(next) => {
              setKeyDraft(next);
              const trimmed = next.trim();
              if (trimmed === '') onKeyChange(null);
              else if (KEY_PATTERN.test(trimmed)) onKeyChange(trimmed);
            }}
            onBlur={() => setKeyDraft(null)}
          />
          {keyInvalid ? (
            <Text style={[styles.hint, { color: colors.error }]}>{t('song_key_invalid')}</Text>
          ) : null}
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>{t('song_tempo')}</Text>
          <TextInput
            testID="song-tempo"
            accessibilityLabel={t('song_tempo')}
            value={tempoText}
            editable={editable}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="90"
            onChangeText={(next) => {
              setTempoDraft(next);
              const digits = Number.parseInt(next, 10);
              if (next.trim() === '') onTempoChange(null);
              else if (digits >= MIN_SONG_TEMPO && digits <= MAX_SONG_TEMPO) onTempoChange(digits);
            }}
            onBlur={() => setTempoDraft(null)}
          />
          {tempoInvalid ? (
            <Text style={[styles.hint, { color: colors.error }]}>
              {t('song_tempo_invalid', { min: MIN_SONG_TEMPO, max: MAX_SONG_TEMPO })}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={[styles.label, { color: colors.text }]}>{t('song_meter')}</Text>
      <View style={styles.pills}>
        {SONG_METERS.map((option) => {
          const active = meter === option;
          return (
            <TouchableOpacity
              key={option}
              testID={`song-meter-${option.replace('/', '-')}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: !editable }}
              disabled={!editable}
              style={[
                styles.pill,
                { borderColor: colors.border },
                active && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => onMeterChange(active ? null : option)}
            >
              <Text style={{ color: active ? colors.onPrimary : colors.text }}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1 },
  label: { fontSize: 15, marginBottom: 6, marginTop: 10 },
  hint: { fontSize: 12, marginTop: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
});

export default SongFactsFields;
