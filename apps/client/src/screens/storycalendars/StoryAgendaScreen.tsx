import { Ionicons } from '@expo/vector-icons';
import {
  calendarMoonPhases,
  calendarSeasonFor,
  attributeDateWeekdayLabels,
  daysInMonth,
  dayNumberToParts,
  formatAttributeDateMonthLabel,
  formatCalendarDate,
  formatGregorianDate,
  gregorianDayNumber,
  gregorianPartsFromDayNumber,
  partsToDayNumber,
} from '@keres/shared';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useStoryAgenda } from '@/src/hooks/useStoryAgenda';
import { useStoryCalendar } from '@/src/hooks/useStoryCalendar';
import type { CustomizationStackParamList } from '@/src/navigation/MainSystemStack';
import { useStoryStore } from '@/src/state/storyStore';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { useTheme } from '@/src/theme';
import { setDocumentTitle } from '@/src/utils/documentTitle';
import { useNavigateToEntityDetail } from '@/src/hooks/useNavigateToEntityDetail';
import { CustomCalendarDateLookup, GregorianCalendarDateLookup } from './AgendaDateLookup';

/**
 * The story's calendar as a month of days, with what happens on each.
 *
 * ## Why it navigates by content
 *
 * The controls move to the next scene and the next event, not to the next month. A story spanning
 * three thousand years has thirty-six thousand months, and paging through empty ones is both
 * useless and the only thing that would make this screen expensive. Navigating by content answers
 * the scale problem and gives the grid a purpose it does not have on its own.
 *
 * ## Why it needs the epoch
 *
 * Without one no scene has an absolute day, so there is nothing to place. The screen says that
 * rather than drawing an empty calendar, which would read as broken.
 */
const StoryAgendaScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const story = useStoryStore((state) => state.selectedStory);
  const dateDisplayFormat = useUserSettingsStore((state) => state.dateDisplayFormat);
  const { calendars, definition: primaryDefinition } = useStoryCalendar(story?.id);
  const route = useRoute<RouteProp<CustomizationStackParamList, 'StoryAgenda'>>();
  const definition = useMemo(() => {
    const requestedId = route.params?.calendarId;
    return requestedId
      ? (calendars.find((calendar) => calendar.id === requestedId)?.definition ?? null)
      : primaryDefinition;
  }, [calendars, primaryDefinition, route.params?.calendarId]);
  const navigation =
    useNavigation<NativeStackNavigationProp<CustomizationStackParamList, 'StoryAgenda'>>();
  const { entries, loading } = useStoryAgenda(definition);
  const [cursor, setCursor] = useState<number | null>(null);
  const navigateToDetail = useNavigateToEntityDetail();

  const describeDay = useCallback(
    (dayNumber: number) => {
      if (!definition) {
        const parts = gregorianPartsFromDayNumber(dayNumber);
        return {
          date: formatGregorianDate(parts, dateDisplayFormat),
          weekday: null,
          season: null,
          moons: [],
        };
      }
      const parts = dayNumberToParts(definition, dayNumber);
      return {
        date: formatCalendarDate(definition, dayNumber),
        weekday: parts.weekday === null ? null : (definition.weekdayNames[parts.weekday] ?? null),
        season: calendarSeasonFor(definition, parts.dayOfYear)?.name ?? null,
        moons: calendarMoonPhases(definition, dayNumber),
      };
    },
    [dateDisplayFormat, definition],
  );

  useFocusEffect(
    useCallback(() => {
      // The drawer owns the header, so the title has to be set on the parent - see
      // `StorySettingsScreen` for what happens when it is not.
      navigation.getParent()?.setOptions({ title: t('agenda_title') });
      setDocumentTitle(t('agenda_title'));
    }, [navigation, t]),
  );

  // Opens on the month holding the first thing that happens, not on year one.
  useEffect(() => {
    if (cursor === null && entries.length > 0) setCursor(entries[0].dayNumber);
  }, [cursor, entries]);

  const byDay = useMemo(() => {
    const map = new Map<number, typeof entries>();
    for (const entry of entries) {
      const existing = map.get(entry.dayNumber);
      if (existing) existing.push(entry);
      else map.set(entry.dayNumber, [entry]);
    }
    return map;
  }, [entries]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        content: { padding: 14, paddingBottom: 40 },
        message: { padding: 28, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          paddingVertical: 7,
          paddingHorizontal: 5,
        },
        monthLabel: {
          flexGrow: 1,
          flexShrink: 1,
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
        },
        nav: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
        navButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 9,
          borderWidth: 1,
          borderColor: colors.border,
        },
        navText: { fontSize: 12, fontWeight: '700', color: colors.primary },
        lookup: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 12,
          marginBottom: 14,
        },
        lookupTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
        lookupRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, zIndex: 2 },
        lookupField: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
        lookupLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 3 },
        lookupInput: {
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          borderRadius: 8,
          paddingHorizontal: 10,
          minHeight: 46,
        },
        lookupYear: { flexGrow: 0, flexShrink: 1, flexBasis: 118 },
        lookupMonth: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
        lookupGo: {
          width: 46,
          minWidth: 46,
          minHeight: 46,
          paddingHorizontal: 0,
          paddingVertical: 0,
          borderRadius: 10,
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
          padding: 7,
          backgroundColor: colors.surface,
        },
        cellInteractive: { borderColor: colors.primary },
        cellToday: {
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
        cellEntry: { fontSize: 9, color: colors.text, marginTop: 1 },
        aside: { fontSize: 12, color: colors.textSecondary, marginTop: 12, lineHeight: 18 },
        dayDetails: {
          marginTop: 14,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        dayDetailsTitle: { fontSize: 15, fontWeight: '700', marginTop: 14, marginBottom: 4 },
        dayEntry: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingVertical: 12,
        },
        dayEntryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        dayEntryTitle: { fontSize: 15, fontWeight: '700' },
        dayEntrySummary: {
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 19,
          marginTop: 4,
          marginBottom: 9,
        },
        eventBadge: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
      }),
    [colors],
  );

  if (story?.timelineEpochDay === null || story?.timelineEpochDay === undefined)
    return (
      <View style={styles.root}>
        <Text style={styles.message}>{t('agenda_no_epoch')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('StoryCalendarList')}>
          <Text style={[styles.message, { color: colors.primary, paddingTop: 0 }]}>
            {t('calendar_epoch_title')}
          </Text>
        </TouchableOpacity>
      </View>
    );

  if (loading || cursor === null)
    return (
      <View style={styles.root}>
        <Text style={styles.message}>{loading ? t('loading') : t('agenda_nothing_placed')}</Text>
      </View>
    );

  const cursorParts = definition
    ? dayNumberToParts(definition, cursor)
    : gregorianPartsFromDayNumber(cursor);
  const daysPerWeek = definition?.daysPerWeek ?? 7;
  const weekdayNames = definition?.weekdayNames ?? attributeDateWeekdayLabels(i18n.language);
  const daysInCurrentMonth = definition
    ? definition.months[cursorParts.month - 1].days
    : daysInMonth(cursorParts.year, cursorParts.month);
  const firstOfMonth = definition
    ? partsToDayNumber(definition, { year: cursorParts.year, month: cursorParts.month, day: 1 })
    : gregorianDayNumber({ year: cursorParts.year, month: cursorParts.month, day: 1 });

  /** The month laid out in rows of the calendar's own week length. */
  const weeks: (number | null)[][] = [];
  // Weekday labels are optional decoration. The week itself is not: without this offset, calendars
  // that omit labels would incorrectly show every month as starting on its first column.
  const offset = ((firstOfMonth % daysPerWeek) + daysPerWeek) % daysPerWeek;
  let week: (number | null)[] = Array.from(
    { length: offset },
    (_, index) => firstOfMonth - offset + index,
  );
  for (let day = 0; day < daysInCurrentMonth; day += 1) {
    week.push(firstOfMonth + day);
    if (week.length === daysPerWeek) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    let nextMonthDay = firstOfMonth + daysInCurrentMonth;
    while (week.length < daysPerWeek) {
      week.push(nextMonthDay);
      nextMonthDay += 1;
    }
    weeks.push(week);
  }

  const jump = (direction: 1 | -1, kind?: 'event') => {
    const candidates = entries
      .filter((entry) => (kind ? entry.kind === kind : true))
      .map((entry) => entry.dayNumber)
      .filter((day) => (direction === 1 ? day > cursor : day < cursor))
      .sort((a, b) => (direction === 1 ? a - b : b - a));
    if (candidates.length > 0) setCursor(candidates[0]);
  };

  const shiftMonth = (direction: 1 | -1) => {
    if (!definition) {
      const zeroBased = cursorParts.month - 1 + direction;
      const year = cursorParts.year + Math.floor(zeroBased / 12);
      const month = (((zeroBased % 12) + 12) % 12) + 1;
      setCursor(gregorianDayNumber({ year, month, day: 1 }));
      return;
    }
    const nextMonth = cursorParts.month + direction;
    const wrappedYear =
      nextMonth < 1
        ? cursorParts.year - 1
        : nextMonth > definition.months.length
          ? cursorParts.year + 1
          : cursorParts.year;
    const wrappedMonth =
      nextMonth < 1
        ? definition.months.length
        : nextMonth > definition.months.length
          ? 1
          : nextMonth;
    setCursor(partsToDayNumber(definition, { year: wrappedYear, month: wrappedMonth, day: 1 }));
  };

  const cursorDescription = describeDay(cursor);
  const selectedEntries = byDay.get(cursor) ?? [];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        {definition ? (
          <CustomCalendarDateLookup
            definition={definition}
            cursor={cursor}
            onMonthChange={setCursor}
            styles={styles}
          />
        ) : (
          <GregorianCalendarDateLookup cursor={cursor} onMonthChange={setCursor} styles={styles} />
        )}

        <View style={styles.nav}>
          <TouchableOpacity style={styles.navButton} onPress={() => jump(-1)}>
            <Ionicons name="arrow-back" size={14} color={colors.primary} />
            <Text style={styles.navText}>{t('agenda_previous_scene')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} onPress={() => jump(1)}>
            <Text style={styles.navText}>{t('agenda_next_scene')}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} onPress={() => jump(1, 'event')}>
            <Text style={styles.navText}>{t('agenda_next_event')}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => shiftMonth(-1)} accessibilityLabel={t('previous')}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {definition
              ? `${definition.months[cursorParts.month - 1].name || cursorParts.month} · ${cursorParts.year}`
              : formatAttributeDateMonthLabel(cursorParts.year, cursorParts.month, i18n.language)}
          </Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} accessibilityLabel={t('next')}>
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
            {row.map((day, cellIndex) => {
              const isOutsideMonth =
                day !== null &&
                (definition ? dayNumberToParts(definition, day) : gregorianPartsFromDayNumber(day))
                  .month !== cursorParts.month;
              return (
                <TouchableOpacity
                  key={day ?? `blank-${cellIndex}`}
                  style={[
                    styles.cell,
                    isOutsideMonth && styles.cellOutsideMonth,
                    day !== null && (byDay.get(day)?.length ?? 0) > 0 && styles.cellInteractive,
                    day === cursor && styles.cellToday,
                  ]}
                  disabled={day === null}
                  onPress={() => day !== null && setCursor(day)}
                  accessibilityRole={day !== null ? 'button' : undefined}
                  accessibilityLabel={
                    day !== null && (byDay.get(day)?.length ?? 0) > 0
                      ? `${describeDay(day)?.date}: ${(byDay.get(day) ?? [])
                          .map((entry) => entry.name)
                          .join(', ')}`
                      : day !== null
                        ? describeDay(day)?.date
                        : undefined
                  }
                >
                  {day !== null && (
                    <>
                      <Text style={[styles.cellDay, isOutsideMonth && styles.cellDayOutside]}>
                        {
                          (definition
                            ? dayNumberToParts(definition, day)
                            : gregorianPartsFromDayNumber(day)
                          ).day
                        }
                      </Text>
                      {(byDay.get(day) ?? []).slice(0, 3).map((entry) => (
                        <Text key={entry.id} numberOfLines={1} style={styles.cellEntry}>
                          {entry.kind === 'event' ? '◆ ' : ''}
                          {entry.name}
                        </Text>
                      ))}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {cursorDescription && (
          <Text style={styles.aside}>
            {[
              cursorDescription.date,
              cursorDescription.season,
              ...cursorDescription.moons.map(
                (moon) => `${moon.name}: ${t(`moon_phase_${moon.phase}`)}`,
              ),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
        {selectedEntries.length > 0 && (
          <View style={styles.dayDetails}>
            <Text style={[styles.dayDetailsTitle, { color: colors.text }]}>
              {cursorDescription?.date}
            </Text>
            {selectedEntries.map((entry) =>
              entry.kind === 'scene' ? (
                <TouchableOpacity
                  key={`${entry.kind}:${entry.id}`}
                  style={styles.dayEntry}
                  onPress={() => navigateToDetail('Scene', entry.id)}
                  accessibilityRole="button"
                  accessibilityLabel={entry.name}
                >
                  <View style={styles.dayEntryRow}>
                    <Text style={[styles.dayEntryTitle, { color: colors.text, flex: 1 }]}>
                      {entry.name}
                    </Text>
                    <Ionicons name="chevron-forward" size={19} color={colors.textSecondary} />
                  </View>
                  {entry.summary ? (
                    <Text style={styles.dayEntrySummary}>{entry.summary}</Text>
                  ) : null}
                </TouchableOpacity>
              ) : (
                <View key={`${entry.kind}:${entry.id}`} style={styles.dayEntry}>
                  <Text style={[styles.dayEntryTitle, { color: colors.text }]}>{entry.name}</Text>
                  <Text style={styles.eventBadge}>{t('agenda_next_event')}</Text>
                </View>
              ),
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default StoryAgendaScreen;
