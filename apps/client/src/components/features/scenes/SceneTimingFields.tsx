import FormField from '@/src/components/common/forms/FormField/FormField';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { isTimingInput, parseTimingInput } from '@/src/utils/sceneTimingInput';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme';

interface CalendarOption {
  id: string;
  name: string;
}

interface SceneTimingFieldsProps {
  gapInput: string;
  onGapInputChange: (value: string) => void;
  gapType: string | null;
  onGapTypeChange: (value: string | null) => void;
  durationInput: string;
  onDurationInputChange: (value: string) => void;
  durationType: string | null;
  onDurationTypeChange: (value: string | null) => void;
  calendarDateOverride: string;
  onCalendarDateOverrideChange: (value: string) => void;
  calendarDateOverrideCalendarId: string | null;
  onCalendarDateOverrideCalendarIdChange: (value: string | null) => void;
  calendars: CalendarOption[];
  inputStyle: StyleProp<TextStyle>;
}

export default function SceneTimingFields({
  gapInput,
  onGapInputChange,
  gapType,
  onGapTypeChange,
  durationInput,
  onDurationInputChange,
  durationType,
  onDurationTypeChange,
  calendarDateOverride,
  onCalendarDateOverrideChange,
  calendarDateOverrideCalendarId,
  onCalendarDateOverrideCalendarIdChange,
  calendars,
  inputStyle,
}: SceneTimingFieldsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const unitOptions = useMemo(
    () => [
      { label: t('seconds'), value: 'seconds' },
      { label: t('minutes'), value: 'minutes' },
      { label: t('hours'), value: 'hours' },
      { label: t('days'), value: 'days' },
      { label: t('weeks'), value: 'weeks' },
      { label: t('months'), value: 'months' },
      { label: t('years'), value: 'years' },
      { label: t('millennia'), value: 'millennia' },
      { label: t('eons'), value: 'eons' },
    ],
    [t],
  );
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 10,
    },
    amountColumn: { width: '30%' },
    typeColumn: { flex: 1, minWidth: 0 },
    typeSelect: { marginBottom: 0 },
    timingHint: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      marginTop: -4,
      marginBottom: 10,
    },
  });

  return (
    <>
      <FormField label={t('gap')}>
        <View style={styles.row}>
          <View style={styles.amountColumn}>
            <TextInput
              placeholder={t('gap_placeholder')}
              value={gapInput}
              onChangeText={(text) => isTimingInput(text) && onGapInputChange(text)}
              keyboardType="numbers-and-punctuation"
              style={inputStyle}
            />
          </View>
          <View style={styles.typeColumn}>
            <SingleSelectPill
              options={unitOptions}
              value={gapType}
              onValueChange={onGapTypeChange}
              placeholder={t('gap_type_placeholder')}
              multiple={false}
              style={styles.typeSelect}
            />
          </View>
        </View>
      </FormField>
      {parseTimingInput(gapInput) !== null && parseTimingInput(gapInput)! < 0 && (
        <Text style={styles.timingHint}>{t('negative_gap_timing_hint')}</Text>
      )}

      <FormField label={t('scene_fixed_date')} help={t('scene_fixed_date_hint')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('scene_fixed_date_placeholder')}
            value={calendarDateOverride}
            onChangeText={onCalendarDateOverrideChange}
            autoCapitalize="none"
            style={inputStyle}
          />
        )}
      </FormField>
      {calendarDateOverride.trim() ? (
        <SingleSelectPill
          options={[
            { label: t('calendar_standard_title'), value: '__gregorian__' },
            ...calendars.map((calendar) => ({ label: calendar.name, value: calendar.id })),
          ]}
          value={calendarDateOverrideCalendarId ?? '__gregorian__'}
          onValueChange={(value) =>
            onCalendarDateOverrideCalendarIdChange(value === '__gregorian__' ? null : value)
          }
          placeholder={t('scene_fixed_date_calendar')}
          multiple={false}
        />
      ) : null}

      <FormField label={t('duration')}>
        <View style={styles.row}>
          <View style={styles.amountColumn}>
            <TextInput
              placeholder={t('duration_placeholder')}
              value={durationInput}
              onChangeText={(text) => isTimingInput(text) && onDurationInputChange(text)}
              keyboardType="numbers-and-punctuation"
              style={inputStyle}
            />
          </View>
          <View style={styles.typeColumn}>
            <SingleSelectPill
              options={unitOptions}
              value={durationType}
              onValueChange={onDurationTypeChange}
              placeholder={t('duration_type_placeholder')}
              multiple={false}
              style={styles.typeSelect}
            />
          </View>
        </View>
      </FormField>
      {parseTimingInput(durationInput) !== null && parseTimingInput(durationInput)! < 0 && (
        <Text style={styles.timingHint}>{t('negative_duration_timing_hint')}</Text>
      )}
    </>
  );
}
