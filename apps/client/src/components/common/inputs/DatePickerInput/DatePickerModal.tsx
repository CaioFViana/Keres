import type { AttributeDateParts } from '@keres/shared';
import {
  attributeDateWeekday,
  attributeDateWeekdayLabels,
  daysInMonth,
  formatAttributeDate,
  formatAttributeDateForDisplay,
  formatAttributeDateMonthLabel,
  fromClockHour,
  MAX_ATTRIBUTE_DATE_YEAR,
  MIN_ATTRIBUTE_DATE_YEAR,
  parseAttributeDate,
  toClockHour,
} from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useUserSettingsStore } from '../../../../state/userSettingsStore';
import { useTheme } from '../../../../theme';

interface DatePickerModalProps {
  /** Canonical value, or anything else - a value this picker cannot read is kept, not erased. */
  value: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
  title?: string;
}

const WEEKDAYS_IN_ROW = 7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * A date calendar (with optional time) for `AttributeType.DATE`. It mirrors `ColorPickerModal`'s
 * structure: it keeps the choice in local state and only returns it on "Select", so leaving through
 * "Cancel" changes nothing.
 *
 * No time zone arithmetic happens here - the date components are handled as numbers and serialised by
 * `formatAttributeDate`. See `attributeDateValue.ts` for why.
 */
const DatePickerModal: React.FC<DatePickerModalProps> = ({ value, onSelect, onClose, title }) => {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const use24HourTime = useUserSettingsStore((state) => state.use24HourTime);

  const parsed = useMemo(() => parseAttributeDate(value), [value]);
  // With no readable value, it opens on today's month - and "today" is the writer's own time zone, the
  // one point at which the system clock legitimately takes part.
  const today = useMemo(() => new Date(), []);

  const [year, setYear] = useState(parsed?.year ?? today.getFullYear());
  const [month, setMonth] = useState(parsed?.month ?? today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(parsed?.day ?? null);
  const [includeTime, setIncludeTime] = useState(parsed !== null && parsed.hour !== null);
  const [hour, setHour] = useState(parsed?.hour ?? 0);
  const [minute, setMinute] = useState(parsed?.minute ?? 0);
  const [yearText, setYearText] = useState(String(parsed?.year ?? today.getFullYear()));
  // Hour and minute hold the TEXT being edited, separate from the number. Mirroring
  // `String(hour).padStart(2, '0')` back into the field turned the first digit into "01" immediately, and
  // then `maxLength={2}` refused the second - typing "10" was impossible.
  const [hourText, setHourText] = useState(
    pad2(toClockHour(parsed?.hour ?? 0, use24HourTime).hour),
  );
  const [minuteText, setMinuteText] = useState(pad2(parsed?.minute ?? 0));
  const [isPm, setIsPm] = useState(toClockHour(parsed?.hour ?? 0, false).isPm);

  const monthLength = daysInMonth(year, month);
  const currentParts: AttributeDateParts | null =
    selectedDay === null
      ? null
      : {
          year,
          month,
          day: Math.min(selectedDay, monthLength),
          hour: includeTime ? hour : null,
          minute: includeTime ? minute : null,
        };

  const previewText = currentParts
    ? (formatAttributeDateForDisplay(formatAttributeDate(currentParts), language, use24HourTime) ??
      formatAttributeDate(currentParts))
    : t('attribute_date_no_date');

  const weekdayLabels = useMemo(() => attributeDateWeekdayLabels(language), [language]);
  const monthLabel = formatAttributeDateMonthLabel(year, month, language);

  // How many empty cells before day 1, so it falls under the right day of the week.
  const leadingBlanks = attributeDateWeekday({
    year,
    month,
    day: 1,
    hour: null,
    minute: null,
  });

  const applyYear = (nextYear: number) => {
    const safeYear = clamp(nextYear, MIN_ATTRIBUTE_DATE_YEAR, MAX_ATTRIBUTE_DATE_YEAR);
    setYear(safeYear);
    setYearText(String(safeYear));
  };

  const shiftMonth = (delta: number) => {
    const zeroBased = month - 1 + delta;
    const nextYear = year + Math.floor(zeroBased / 12);
    const nextMonth = (((zeroBased % 12) + 12) % 12) + 1;
    if (nextYear < MIN_ATTRIBUTE_DATE_YEAR || nextYear > MAX_ATTRIBUTE_DATE_YEAR) {
      return;
    }
    applyYear(nextYear);
    setMonth(nextMonth);
    // A selected 31st cannot survive a 30-day month - it shortens instead of disappearing.
    setSelectedDay((current) =>
      current === null ? null : Math.min(current, daysInMonth(nextYear, nextMonth)),
    );
  };

  // In AM/PM the field works from 1 to 12 and the period sits in the button beside it; the STORED hour
  // is always 0 to 23 - only the field's reading/writing changes shape.
  const minHourInput = use24HourTime ? 0 : 1;
  const maxHourInput = use24HourTime ? 23 : 12;

  /** It lets the text be typed freely; only the derived number is clamped. */
  const handleTimeChange = (
    text: string,
    min: number,
    max: number,
    setText: (next: string) => void,
    setNumber: (next: number) => void,
  ) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 2);
    const numeric = clamp(Number(digits) || min, min, max);
    setText(Number(digits) > max ? pad2(numeric) : digits);
    setNumber(numeric);
  };

  const handleHourChange = (text: string) => {
    handleTimeChange(text, minHourInput, maxHourInput, setHourText, (clockHour) =>
      setHour(fromClockHour(clockHour, isPm, use24HourTime)),
    );
  };

  const togglePeriod = () => {
    const nextIsPm = !isPm;
    setIsPm(nextIsPm);
    setHour(fromClockHour(Number(hourText) || 12, nextIsPm, false));
  };

  const goToToday = () => {
    applyYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelectedDay(today.getDate());
  };

  const handleConfirm = () => {
    onSelect(currentParts ? formatAttributeDate(currentParts) : null);
  };

  const styles = StyleSheet.create({
    container: { backgroundColor: colors.background, flexShrink: 1 },
    content: { padding: 20 },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 12,
      color: colors.text,
      textAlign: 'center',
    },
    preview: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 16,
      textTransform: 'capitalize',
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    navButton: { padding: 8 },
    monthLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      textTransform: 'capitalize',
    },
    yearRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    yearLabel: { color: colors.textSecondary, fontSize: 13, marginRight: 8 },
    yearInput: { width: 90, height: 40, marginBottom: 0 },
    quickActions: { flexDirection: 'row', marginLeft: 'auto' },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    weekRow: { flexDirection: 'row' },
    weekdayCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 6,
    },
    weekdayText: { fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase' },
    dayCell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      margin: 1,
    },
    dayCellSelected: { backgroundColor: colors.primary },
    dayText: { fontSize: 15, color: colors.text },
    dayTextSelected: { color: colors.onPrimary, fontWeight: 'bold' },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    timeLabel: { fontSize: 15, color: colors.text },
    timeInputs: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    timeInput: { width: 64, height: 44, marginBottom: 0, textAlign: 'center' },
    timeSeparator: { fontSize: 20, color: colors.text, marginHorizontal: 8 },
    periodButton: {
      marginLeft: 12,
      paddingHorizontal: 14,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    periodText: { color: colors.primary, fontWeight: 'bold', fontSize: 15 },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    actionButton: { width: '47%' },
  });

  const dayCells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: monthLength }, (_, index) => index + 1),
  ];
  while (dayCells.length % WEEKDAYS_IN_ROW !== 0) {
    dayCells.push(null);
  }
  const dayRows = Array.from({ length: dayCells.length / WEEKDAYS_IN_ROW }, (_, rowIndex) =>
    dayCells.slice(rowIndex * WEEKDAYS_IN_ROW, (rowIndex + 1) * WEEKDAYS_IN_ROW),
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {title && <Text style={styles.title}>{title}</Text>}

      <Text style={styles.preview} testID="date-picker-preview">
        {previewText}
      </Text>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => shiftMonth(-1)}
          testID="date-picker-prev-month"
          accessibilityLabel={t('attribute_date_previous_month')}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthLabel} testID="date-picker-month">
          {monthLabel}
        </Text>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => shiftMonth(1)}
          testID="date-picker-next-month"
          accessibilityLabel={t('attribute_date_next_month')}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.yearRow}>
        <Text style={styles.yearLabel}>{t('attribute_date_year')}</Text>
        <TextInput
          style={styles.yearInput}
          value={yearText}
          onChangeText={(text) => {
            const digits = text.replace(/[^0-9]/g, '').slice(0, 4);
            setYearText(digits);
            const parsedYear = Number(digits);
            if (digits && Number.isFinite(parsedYear) && parsedYear >= MIN_ATTRIBUTE_DATE_YEAR) {
              setYear(clamp(parsedYear, MIN_ATTRIBUTE_DATE_YEAR, MAX_ATTRIBUTE_DATE_YEAR));
            }
          }}
          onBlur={() => applyYear(Number(yearText) || year)}
          keyboardType="numeric"
          testID="date-picker-year"
        />

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={goToToday}
            testID="date-picker-today"
            accessibilityLabel={t('attribute_date_today')}
          >
            <Ionicons name="today-outline" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => onSelect(null)}
            testID="date-picker-clear"
            accessibilityLabel={t('attribute_date_clear')}
          >
            <Ionicons name="backspace-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.weekRow}>
        {weekdayLabels.map((label, index) => (
          <View key={`${label}-${index}`} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>

      {dayRows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.weekRow}>
          {row.map((day, columnIndex) => {
            if (day === null) {
              return <View key={`blank-${rowIndex}-${columnIndex}`} style={styles.dayCell} />;
            }
            const isSelected = currentParts?.day === day;
            return (
              <TouchableOpacity
                key={`day-${day}`}
                style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                onPress={() => setSelectedDay(day)}
                testID={`date-picker-day-${day}`}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>{t('attribute_date_include_time')}</Text>
        <ThemedSwitch
          value={includeTime}
          onValueChange={setIncludeTime}
          testID="date-picker-include-time"
        />
      </View>

      {includeTime && (
        <View style={styles.timeInputs}>
          <TextInput
            style={styles.timeInput}
            value={hourText}
            onChangeText={handleHourChange}
            onBlur={() => setHourText(pad2(toClockHour(hour, use24HourTime).hour))}
            keyboardType="numeric"
            maxLength={2}
            selectTextOnFocus
            accessibilityLabel={t('attribute_date_hour')}
            testID="date-picker-hour"
          />
          <Text style={styles.timeSeparator}>:</Text>
          <TextInput
            style={styles.timeInput}
            value={minuteText}
            onChangeText={(text) => handleTimeChange(text, 0, 59, setMinuteText, setMinute)}
            onBlur={() => setMinuteText(pad2(minute))}
            keyboardType="numeric"
            maxLength={2}
            selectTextOnFocus
            accessibilityLabel={t('attribute_date_minute')}
            testID="date-picker-minute"
          />
          {!use24HourTime && (
            <TouchableOpacity
              style={styles.periodButton}
              onPress={togglePeriod}
              testID="date-picker-period"
              accessibilityLabel={t('attribute_date_period')}
            >
              <Text style={styles.periodText}>
                {isPm ? t('attribute_date_pm') : t('attribute_date_am')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.actionRow}>
        <Button
          onPress={onClose}
          style={[styles.actionButton, { backgroundColor: colors.textSecondary }]}
        >
          {t('cancel')}
        </Button>
        <Button
          onPress={handleConfirm}
          disabled={currentParts === null}
          style={styles.actionButton}
          testID="date-picker-confirm"
        >
          {t('select')}
        </Button>
      </View>
    </ScrollView>
  );
};

export default DatePickerModal;
