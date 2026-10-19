import { Ionicons } from '@expo/vector-icons';
import { type CalendarDateCoordinate, fromClockHour, toClockHour } from '@keres/shared';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import CalendarMonthGrid from '@/src/components/features/calendars/CalendarMonthGrid/CalendarMonthGrid';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { useTheme } from '@/src/theme';
import { getCommonInputStyles } from '@/src/theme/commonStyles';
import {
  type CalendarOrGregorian,
  clampCoordinate,
  describeCoordinate,
  eraStartYearFor,
  formatTimeOfDay,
  monthOptions,
  usesTwelveHourClock,
} from '@/src/utils/calendar/calendarDateFields';
import { dayNumberOf, dayPartsOf, shiftMonth } from '@/src/utils/calendar/calendarMonthGrid';

interface Props {
  /** The calendar the date is written in; `null` is Gregorian. */
  calendar: CalendarOrGregorian;
  value: CalendarDateCoordinate;
  onChange: (next: CalendarDateCoordinate) => void;
  /** Adds the hour and the minute. */
  withTime?: boolean;
  editable?: boolean;
}

type TextPart = 'year' | 'day' | 'hour' | 'minute';

const INTEGER = /^-?\d*$/;
const DIGITS = /^\d*$/;

/** The hour as the field shows it: 1 to 12 on a 12-hour clock, the stored one (0-23, or the calendar's own) otherwise. */
const shownHour = (hour: number, twelveHour: boolean) =>
  twelveHour ? toClockHour(hour, false).hour : hour;

const textsOf = (value: CalendarDateCoordinate, twelveHour: boolean): Record<TextPart, string> => ({
  year: String(value.year),
  day: String(value.day),
  hour: String(shownHour(value.hour, twelveHour)),
  minute: String(value.minute),
});

/** What a text means as a number, or `null` while it is still being typed ("", "-"). */
const numberOf = (part: TextPart, text: string, twelveHour = false): number | null => {
  if (text === '' || text === '-') return null;
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) return null;
  // There is no day 0, but there is an hour 0: a lone "0" in the day is the start of "05". On a 12-hour
  // clock the hour has no 0 either - it starts at 1.
  if (part === 'day' && parsed < 1) return null;
  if (part === 'hour' && twelveHour && parsed < 1) return null;
  return parsed;
};

/**
 * A date in a calendar - the era, day, month and year, and the hour and minute when `withTime` - as
 * fields that only offer what the calendar has: its own month names, its eras, the days its month
 * really has. A calendar button opens the month as a grid to tap.
 *
 * Every change goes through `clampCoordinate`, so what is reported always exists in the calendar: the
 * 31st of a 28-day month is the 28th, not a date nothing can read back. The year is the one open number
 * (it can be negative, a story may open before its own era).
 */
const CalendarDateFields: React.FC<Props> = ({
  calendar,
  value,
  onChange,
  withTime = false,
  editable = true,
}) => {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const dateDisplayFormat = useUserSettingsStore((state) => state.dateDisplayFormat);
  const use24HourTime = useUserSettingsStore((state) => state.use24HourTime);
  const twelveHour = usesTwelveHourClock(calendar, use24HourTime);
  const isPm = value.hour >= 12;
  const inputStyles = useMemo(() => getCommonInputStyles(colors), [colors]);
  const [pickerOpen, setPickerOpen] = useState(false);

  /*
   * The texts are what the writer is typing; the value is what was committed from them. They only
   * differ while a text is unfinished ("-" on the way to "-400") or when something else changed the
   * value (the grid, an era, another calendar) - and then the texts follow the value.
   */
  const [texts, setTexts] = useState(() => textsOf(value, twelveHour));
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    const typed = {
      year: numberOf('year', texts.year),
      day: numberOf('day', texts.day),
      hour: numberOf('hour', texts.hour, twelveHour),
      minute: numberOf('minute', texts.minute),
    };
    const same =
      typed.year === value.year &&
      typed.day === value.day &&
      typed.hour === shownHour(value.hour, twelveHour) &&
      typed.minute === value.minute;
    if (!same) setTexts(textsOf(value, twelveHour));
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 8 },
        field: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
        select: { marginBottom: 0 },
        label: { fontSize: 11, color: colors.textSecondary, marginBottom: 3 },
        echoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
        echoText: { flexGrow: 1, flexShrink: 1 },
        echo: { fontSize: 13, color: colors.text, fontWeight: '600' },
        aside: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
        pick: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 9,
          borderWidth: 1,
          borderColor: colors.border,
        },
        pickText: { fontSize: 12, fontWeight: '700', color: colors.primary },
        period: {
          minWidth: 64,
          height: 50,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 5,
          borderWidth: 1,
          borderColor: colors.primary,
          backgroundColor: colors.surface,
        },
        periodText: { fontSize: 16, fontWeight: '700', color: colors.primary },
      }),
    [colors],
  );

  /*
   * A change builds on what the fields show, not only on the value: a parent that has not echoed the
   * last keystroke back yet would otherwise lose it to the next one.
   */
  const typedHour = () => {
    const typed = numberOf('hour', texts.hour, twelveHour);
    if (typed === null) return value.hour;
    return twelveHour ? fromClockHour(Math.min(typed, 12), isPm, false) : typed;
  };

  const commit = (changes: Partial<CalendarDateCoordinate>) =>
    onChange(
      clampCoordinate(calendar, {
        ...value,
        year: numberOf('year', texts.year) ?? value.year,
        day: numberOf('day', texts.day) ?? value.day,
        hour: typedHour(),
        minute: numberOf('minute', texts.minute) ?? value.minute,
        ...changes,
      }),
    );

  const typeInto = (part: TextPart, text: string) => {
    if (text && !(part === 'year' ? INTEGER : DIGITS).test(text)) return;
    setTexts((current) => ({ ...current, [part]: text }));
    const parsed = numberOf(part, text, twelveHour);
    if (parsed === null) return;
    // On a 12-hour clock the typed hour is the clock's (1-12): the value's period gives it its 0-23.
    commit({
      [part]:
        part === 'hour' && twelveHour ? fromClockHour(Math.min(parsed, 12), isPm, false) : parsed,
    });
  };

  const numberField = (part: TextPart, label: string) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={texts[part]}
        editable={editable}
        onChangeText={(text) => typeInto(part, text)}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel={label}
        style={[inputStyles.input, { marginBottom: 0 }]}
      />
    </View>
  );

  const eraStart = eraStartYearFor(calendar, value.year);
  const description = describeCoordinate(calendar, value, i18n.language, dateDisplayFormat);
  const time = withTime
    ? formatTimeOfDay(value, twelveHour, { am: t('attribute_date_am'), pm: t('attribute_date_pm') })
    : null;
  const aside = [
    description.weekday,
    description.season,
    ...description.moons.map((moon) => `${moon.name}: ${t(`moon_phase_${moon.phase}`)}`),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View>
      {calendar && calendar.eras.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.label}>{t('calendar_eras')}</Text>
          <SingleSelectPill
            options={calendar.eras.map((era) => ({
              label: `${era.name} (${era.abbreviation})`,
              value: String(era.startYear),
            }))}
            value={eraStart === null ? null : String(eraStart)}
            // Picking an era moves to its first year: the coarse jump, with the year field for the rest.
            onValueChange={(startYear) => startYear !== null && commit({ year: Number(startYear) })}
            placeholder={t('story_date_pick_era')}
            style={styles.select}
            disabled={!editable}
            multiple={false}
          />
        </View>
      )}

      <View style={styles.row}>
        {numberField('day', t('calendar_epoch_day'))}
        <View style={[styles.field, { flexGrow: 2 }]}>
          <Text style={styles.label}>{t('calendar_epoch_month')}</Text>
          <SingleSelectPill
            options={monthOptions(calendar, i18n.language)}
            value={String(value.month)}
            onValueChange={(month) => month !== null && commit({ month: Number(month) })}
            // The title of the list it opens: without one the shared selector says "Select tags".
            placeholder={t('calendar_epoch_month')}
            // Bottom-aligned beside the number fields, which have no margin: the pill's own would lift it.
            style={styles.select}
            disabled={!editable}
            multiple={false}
          />
        </View>
        {numberField('year', t('calendar_epoch_year'))}
      </View>

      {withTime && (
        <View style={styles.row}>
          {numberField('hour', t('calendar_epoch_hour'))}
          {numberField('minute', t('calendar_epoch_minute'))}
          {twelveHour && (
            <TouchableOpacity
              style={styles.period}
              disabled={!editable}
              // The period is the value's: the clock hour stays, the stored hour moves half a day.
              onPress={() => commit({ hour: (typedHour() + 12) % 24 })}
              accessibilityRole="button"
              accessibilityLabel={t('attribute_date_period')}
              testID="calendar-date-period"
            >
              <Text style={styles.periodText}>
                {isPm ? t('attribute_date_pm') : t('attribute_date_am')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.echoRow}>
        <View style={styles.echoText}>
          <Text style={styles.echo}>
            {time ? `${description.date} · ${time}` : description.date}
          </Text>
          {aside ? <Text style={styles.aside}>{aside}</Text> : null}
        </View>
        {editable && (
          <TouchableOpacity
            style={styles.pick}
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('calendar_pick_date')}
            testID="calendar-date-pick"
          >
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={styles.pickText}>{t('calendar_pick_date')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <CalendarDatePickerModal
        visible={pickerOpen}
        calendar={calendar}
        value={value}
        onClose={() => setPickerOpen(false)}
        onPick={(day) => {
          commit(day);
          setPickerOpen(false);
        }}
      />
    </View>
  );
};

interface PickerProps {
  visible: boolean;
  calendar: CalendarOrGregorian;
  value: CalendarDateCoordinate;
  onClose: () => void;
  onPick: (day: { year: number; month: number; day: number }) => void;
}

/** The month of the date as a grid; the browsing is the modal's, the date only changes on a tap. */
const CalendarDatePickerModal: React.FC<PickerProps> = ({
  visible,
  calendar,
  value,
  onClose,
  onPick,
}) => {
  const { t } = useTranslation();
  const [cursor, setCursor] = useState({ year: value.year, month: value.month });

  // Each opening starts on the month of the date being edited, not wherever it was last left.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setCursor({ year: value.year, month: value.month });
  }

  const selectedDay = dayNumberOf(calendar, value);

  return (
    <ResponsiveModal visible={visible} onClose={onClose} inset="regular" maxHeight="86%">
      <ModalHeader title={t('calendar_pick_date')} onClose={onClose} />
      <CalendarMonthGrid
        calendar={calendar}
        year={cursor.year}
        month={cursor.month}
        selectedDay={selectedDay}
        onSelectDay={(dayNumber) => onPick(dayPartsOf(calendar, dayNumber))}
        onShiftMonth={(direction) =>
          setCursor((current) => shiftMonth(calendar, current.year, current.month, direction))
        }
        compact
      />
    </ResponsiveModal>
  );
};

export default CalendarDateFields;
