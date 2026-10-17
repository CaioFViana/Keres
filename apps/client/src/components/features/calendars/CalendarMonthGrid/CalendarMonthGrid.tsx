import { Ionicons } from '@expo/vector-icons';
import { attributeDateWeekdayLabels, formatAttributeDateMonthLabel } from '@keres/shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type ThemeColors, useTheme } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import type { CalendarOrGregorian } from '@/src/utils/calendar/calendarDateFields';
import { calendarMonthWeeks, dayPartsOf } from '@/src/utils/calendar/calendarMonthGrid';

export interface CalendarGridEntry {
  id: string;
  name: string;
  kind: 'scene' | 'event';
}

interface Props {
  /** The calendar the month belongs to; `null` is Gregorian. */
  calendar: CalendarOrGregorian;
  year: number;
  month: number;
  /** The highlighted day, as a day number. */
  selectedDay: number | null;
  onSelectDay: (dayNumber: number) => void;
  onShiftMonth: (direction: 1 | -1) => void;
  /** What happens on each day, named inside its cell; days with entries get an outline. */
  entriesByDay?: ReadonlyMap<number, readonly CalendarGridEntry[]>;
  /** The spoken name of a day, for screen readers. */
  describeDay?: (dayNumber: number) => string | undefined;
  /** Small cells with only the day number: a date picker rather than an agenda. */
  compact?: boolean;
}

/**
 * One month of a story's calendar as a grid of days, whatever the calendar: any number of months of
 * any length, any week length, Gregorian included.
 *
 * It only draws and reports taps. Which month is shown, which day is selected and what to do on a tap
 * belong to the caller - the agenda browses with it, the date fields pick with it.
 */
const CalendarMonthGrid: React.FC<Props> = ({
  calendar,
  year,
  month,
  selectedDay,
  onSelectDay,
  onShiftMonth,
  entriesByDay,
  describeDay,
  compact = false,
}) => {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const { weeks } = useMemo(
    () => calendarMonthWeeks(calendar, year, month),
    [calendar, year, month],
  );
  const weekdayNames = calendar?.weekdayNames ?? attributeDateWeekdayLabels(i18n.language);
  const monthLabel = calendar
    ? `${calendar.months[month - 1]?.name || month} · ${year}`
    : formatAttributeDateMonthLabel(year, month, i18n.language);

  return (
    <View>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onShiftMonth(-1)} accessibilityLabel={t('previous')}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={() => onShiftMonth(1)} accessibilityLabel={t('next')}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {weekdayNames.length > 0 && (
        <View style={styles.week}>
          {weekdayNames.map((label, index) => (
            <View key={`${label}-${index}`} style={styles.weekdayCell}>
              <Text style={styles.weekdayText}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      {weeks.map((row, rowIndex) => (
        // The row's position is its identity: a month grid has no other.
        <View key={rowIndex} style={styles.week}>
          {row.map((day) => {
            const parts = dayPartsOf(calendar, day);
            const outside = parts.month !== month || parts.year !== year;
            const entries = entriesByDay?.get(day) ?? [];
            const spoken = describeDay?.(day);
            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.cell,
                  compact && styles.cellCompact,
                  outside && styles.cellOutsideMonth,
                  entries.length > 0 && styles.cellInteractive,
                  day === selectedDay && styles.cellSelected,
                ]}
                onPress={() => onSelectDay(day)}
                accessibilityRole="button"
                accessibilityState={{ selected: day === selectedDay }}
                accessibilityLabel={
                  entries.length > 0
                    ? `${spoken}: ${entries.map((entry) => entry.name).join(', ')}`
                    : spoken
                }
              >
                <Text style={[styles.cellDay, outside && styles.cellDayOutside]}>{parts.day}</Text>
                {!compact &&
                  entries.slice(0, 3).map((entry) => (
                    <Text key={entry.id} numberOfLines={1} style={styles.cellEntry}>
                      {entry.kind === 'event' ? '◆ ' : ''}
                      {entry.name}
                    </Text>
                  ))}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
      paddingVertical: 8,
      paddingHorizontal: 5,
    },
    monthLabel: {
      flexGrow: 1,
      flexShrink: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    week: { flexDirection: 'row', gap: 5, marginBottom: 5 },
    weekdayCell: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      alignItems: 'center',
      paddingBottom: 5,
    },
    weekdayText: { fontSize: 10, color: colors.textSecondary, fontWeight: '700' },
    cell: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minHeight: 74,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 8,
      backgroundColor: colors.surface,
    },
    cellCompact: { minHeight: 40, padding: 4, alignItems: 'center', justifyContent: 'center' },
    cellInteractive: { borderColor: colors.primary },
    cellSelected: {
      backgroundColor: colors.primaryContainer,
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    cellOutsideMonth: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      opacity: 0.68,
    },
    cellDay: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    cellDayOutside: { color: colors.textSecondary, fontWeight: '500' },
    cellEntry: { fontSize: 10, color: colors.text, marginTop: 1 },
  });

export default CalendarMonthGrid;
