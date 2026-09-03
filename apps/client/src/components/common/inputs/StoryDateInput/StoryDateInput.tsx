import {
  calendarMoonPhases,
  calendarSeasonFor,
  dayNumberToParts,
  formatCalendarDate,
  partsToDayNumber,
} from '@keres/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useStoryCalendar } from '@/src/hooks/useStoryCalendar';
import { useTheme } from '@/src/theme';
import { getCommonInputStyles } from '@/src/theme/commonStyles';

/**
 * A date in the story's own calendar.
 *
 * ## Why this is not a grid
 *
 * There is no month grid to tap. A grid drawn in an invented calendar is the expensive half of a
 * date picker - `DatePickerModal` is 440 lines of `Intl` handling - and its value is saving typing.
 * The era and month selects save most of that typing on their own, which is the same move a normal
 * picker makes when it offers a decade before a year.
 *
 * ## Why the value is a day number
 *
 * `AttributeType.DATE` stores a canonical `YYYY-MM-DD` string, validated by round-trip. A calendar
 * of thirteen 28-day months breaks that format outright, so this type stores the integer day
 * instead - which also means renaming a month later changes fifty labels rather than fifty values.
 */

interface Props {
  /** The stored day number, as text. `null` when nothing has been entered. */
  value: string | null;
  onChange: (value: string | null) => void;
  editable?: boolean;
}

const StoryDateInput: React.FC<Props> = ({ value, onChange, editable = true }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { definition } = useStoryCalendar();
  const inputStyles = useMemo(() => getCommonInputStyles(colors), [colors]);

  const [year, setYear] = useState('1');
  const [month, setMonth] = useState('1');
  const [day, setDay] = useState('1');

  useEffect(() => {
    if (!definition || value === null || value === '') return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const parts = dayNumberToParts(definition, parsed);
    setYear(String(parts.year));
    setMonth(String(parts.month));
    setDay(String(parts.day));
  }, [definition, value]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
        field: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
        label: { fontSize: 11, color: colors.textSecondary, marginBottom: 3 },
        echo: { fontSize: 13, color: colors.text, marginTop: 8, fontWeight: '600' },
        aside: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
        missing: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
      }),
    [colors],
  );

  /*
   * With no calendar there is nothing to enter a date against, and the field says so rather than
   * offering an input whose value could not be read back.
   */
  if (!definition) return <Text style={styles.missing}>{t('story_date_no_calendar')}</Text>;

  const commit = (nextYear: string, nextMonth: string, nextDay: string) => {
    const dayNumber = partsToDayNumber(definition, {
      year: Number(nextYear) || 1,
      month: Number(nextMonth) || 1,
      day: Number(nextDay) || 1,
    });
    onChange(String(dayNumber));
  };

  const currentDay = partsToDayNumber(definition, {
    year: Number(year) || 1,
    month: Number(month) || 1,
    day: Number(day) || 1,
  });
  const parts = dayNumberToParts(definition, currentDay);
  const season = calendarSeasonFor(definition, parts.dayOfYear);
  const moons = calendarMoonPhases(definition, currentDay);
  /*
   * The era the current year falls in, found here rather than taken from `calendarEraFor`, which
   * reports the era's *name* and the year within it. The select is keyed by `startYear`, and
   * recovering that from the counted year is arithmetic nobody reading this should have to do.
   */
  const currentEra = [...definition.eras]
    .sort((a, b) => a.startYear - b.startYear)
    .filter((candidate) => candidate.startYear <= parts.year)
    .pop();

  /** Keyed by which part it edits, so the commit does not have to infer it from a label. */
  const numberField = (part: 'year' | 'day', label: string) => {
    const current = part === 'year' ? year : day;
    const set = part === 'year' ? setYear : setDay;
    // Only the year can be negative: a story may open before its own era began.
    const pattern = part === 'year' ? /^-?\d*$/ : /^\d*$/;
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          value={current}
          editable={editable}
          onChangeText={(text) => {
            if (text && !pattern.test(text)) return;
            set(text);
            commit(part === 'year' ? text : year, month, part === 'day' ? text : day);
          }}
          keyboardType="numbers-and-punctuation"
          style={[inputStyles.input, { marginBottom: 0 }]}
        />
      </View>
    );
  };

  return (
    <View>
      {definition.eras.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.label}>{t('calendar_eras')}</Text>
          <SingleSelectPill
            options={definition.eras.map((candidate) => ({
              label: `${candidate.name} (${candidate.abbreviation})`,
              value: String(candidate.startYear),
            }))}
            value={currentEra ? String(currentEra.startYear) : null}
            onValueChange={(startYear) => {
              /*
               * Picking an era moves to its first year, which is the coarse jump this control
               * exists for: the fine adjustment is the year field beside it.
               */
              if (startYear === null) return;
              const next = String(Number(startYear));
              setYear(next);
              commit(next, month, day);
            }}
            placeholder={t('story_date_pick_era')}
            multiple={false}
          />
        </View>
      )}

      <View style={styles.row}>
        {numberField('day', t('calendar_epoch_day'))}
        <View style={[styles.field, { flexGrow: 2 }]}>
          <Text style={styles.label}>{t('calendar_epoch_month')}</Text>
          <SingleSelectPill
            options={definition.months.map((candidate, index) => ({
              label: candidate.name || String(index + 1),
              value: String(index + 1),
            }))}
            value={month}
            onValueChange={(next) => {
              if (next === null) return;
              setMonth(next);
              commit(year, next, day);
            }}
            multiple={false}
          />
        </View>
        {numberField('year', t('calendar_epoch_year'))}
      </View>

      <Text style={styles.echo}>{formatCalendarDate(definition, currentDay)}</Text>
      {(season || moons.length > 0 || parts.weekday !== null) && (
        <Text style={styles.aside}>
          {[
            parts.weekday !== null ? definition.weekdayNames[parts.weekday] : null,
            season?.name,
            ...moons.map((moon) => `${moon.name}: ${t(`moon_phase_${moon.phase}`)}`),
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      )}
    </View>
  );
};

export default StoryDateInput;
