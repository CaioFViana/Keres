import { Ionicons } from '@expo/vector-icons';
import {
  calendarMoonPhases,
  calendarSeasonFor,
  dayNumberToParts,
  formatCalendarDate,
  partsToDayNumber,
} from '@keres/shared';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextStyle, ViewStyle } from 'react-native';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useStoryAgenda } from '@/src/hooks/useStoryAgenda';
import { useStoryCalendar } from '@/src/hooks/useStoryCalendar';
import type { CustomizationStackParamList } from '@/src/navigation/MainSystemStack';
import { useStoryStore } from '@/src/state/storyStore';
import { useTheme } from '@/src/theme';
import { setDocumentTitle } from '@/src/utils/documentTitle';
import Select from '@/src/components/common/inputs/Select/Select';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useNavigateToEntityDetail } from '@/src/hooks/useNavigateToEntityDetail';
import Button from '@/src/components/common/controls/Button/Button';

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
  const { t } = useTranslation();
  const { colors } = useTheme();
  const story = useStoryStore((state) => state.selectedStory);
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
      if (!definition) return null;
      const parts = dayNumberToParts(definition, dayNumber);
      return {
        date: formatCalendarDate(definition, dayNumber),
        weekday: parts.weekday === null ? null : (definition.weekdayNames[parts.weekday] ?? null),
        season: calendarSeasonFor(definition, parts.dayOfYear)?.name ?? null,
        moons: calendarMoonPhases(definition, dayNumber),
      };
    },
    [definition],
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

  if (!definition)
    return (
      <View style={styles.root}>
        <Text style={styles.message}>{t('agenda_no_calendar')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('StoryCalendarList')}>
          <Text style={[styles.message, { color: colors.primary, paddingTop: 0 }]}>
            {t('calendar_list_title')}
          </Text>
        </TouchableOpacity>
      </View>
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

  const cursorParts = dayNumberToParts(definition, cursor);
  const month = definition.months[cursorParts.month - 1];
  const firstOfMonth = partsToDayNumber(definition, {
    year: cursorParts.year,
    month: cursorParts.month,
    day: 1,
  });

  /** The month laid out in rows of the calendar's own week length. */
  const weeks: (number | null)[][] = [];
  // Weekday labels are optional decoration. The week itself is not: without this offset, calendars
  // that omit labels would incorrectly show every month as starting on its first column.
  const offset =
    ((firstOfMonth % definition.daysPerWeek) + definition.daysPerWeek) % definition.daysPerWeek;
  let week: (number | null)[] = Array.from(
    { length: offset },
    (_, index) => firstOfMonth - offset + index,
  );
  for (let day = 0; day < month.days; day += 1) {
    week.push(firstOfMonth + day);
    if (week.length === definition.daysPerWeek) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    let nextMonthDay = firstOfMonth + month.days;
    while (week.length < definition.daysPerWeek) {
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
        <DateLookup
          definition={definition}
          cursor={cursor}
          onMonthChange={setCursor}
          styles={styles}
        />

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
            {month.name || cursorParts.month} · {cursorParts.year}
          </Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} accessibilityLabel={t('next')}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {definition.weekdayNames.length > 0 && (
          <View style={styles.week}>
            {definition.weekdayNames.map((label, index) => (
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
                day !== null && dayNumberToParts(definition, day).month !== cursorParts.month;
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
                        {dayNumberToParts(definition, day).day}
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

const DateLookup = React.memo(function DateLookup({
  definition,
  cursor,
  onMonthChange,
  styles,
}: {
  definition: NonNullable<ReturnType<typeof useStoryCalendar>['definition']>;
  cursor: number;
  onMonthChange: (day: number) => void;
  styles: {
    lookup: ViewStyle;
    lookupTitle: TextStyle;
    lookupRow: ViewStyle;
    lookupField: ViewStyle;
    lookupLabel: TextStyle;
    lookupInput: TextStyle;
    lookupYear: ViewStyle;
    lookupMonth: ViewStyle;
    lookupGo: ViewStyle;
  };
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const initialParts = useMemo(() => dayNumberToParts(definition, cursor), [definition, cursor]);
  const [yearText, setYearText] = useState(() => String(initialParts.year));
  const [monthValue, setMonthValue] = useState(() => String(initialParts.month));
  const [eraValue, setEraValue] = useState<string | null>(null);

  useEffect(() => {
    const next = dayNumberToParts(definition, cursor);
    setYearText(String(next.year));
    setMonthValue(String(next.month));
  }, [cursor, definition]);

  const open = useCallback(
    (next: { year: number; month: number }) => {
      if (!Number.isInteger(next.year) || !Number.isInteger(next.month)) return;
      onMonthChange(partsToDayNumber(definition, { ...next, day: 1 }));
    },
    [definition, onMonthChange],
  );
  const eras = useMemo(() => {
    const ordered = [...definition.eras].sort((a, b) => a.startYear - b.startYear);
    return ordered.map((era, index) => {
      const next = ordered[index + 1];
      const range =
        era.direction === 'backward'
          ? `≤ ${era.startYear - 1}`
          : `${era.startYear}–${next ? next.startYear - 1 : '∞'}`;
      return { label: `${era.name} (${era.abbreviation}) · ${range}`, value: String(index) };
    });
  }, [definition.eras]);

  return (
    <View style={styles.lookup}>
      <Text style={styles.lookupTitle}>{t('agenda_go_to_date')}</Text>
      {eras.length > 0 && (
        <View style={{ marginBottom: 8, zIndex: 3 }}>
          <Text style={styles.lookupLabel}>{t('calendar_eras')}</Text>
          <Select
            options={eras}
            value={eraValue}
            onValueChange={(value) => {
              setEraValue(value);
              if (value === null) return;
              const era = [...definition.eras].sort((a, b) => a.startYear - b.startYear)[
                Number(value)
              ];
              if (!era) return;
              const year = era.direction === 'backward' ? era.startYear - 1 : era.startYear;
              setYearText(String(year));
            }}
            placeholder={t('agenda_pick_era')}
            multiple={false}
          />
        </View>
      )}
      <View style={styles.lookupRow}>
        <View style={[styles.lookupField, styles.lookupYear]}>
          <Text style={styles.lookupLabel}>{t('calendar_epoch_year')}</Text>
          <TextInput
            value={yearText}
            onChangeText={(text) => {
              if (!text || /^-?\d*$/.test(text)) setYearText(text);
            }}
            onEndEditing={() => {
              if (!Number.isInteger(Number(yearText))) return;
            }}
            keyboardType="numbers-and-punctuation"
            style={styles.lookupInput}
          />
        </View>
        <View style={[styles.lookupField, styles.lookupMonth]}>
          <Text style={styles.lookupLabel}>{t('calendar_epoch_month')}</Text>
          <Select
            options={definition.months.map((month, index) => ({
              label: month.name || String(index + 1),
              value: String(index + 1),
            }))}
            value={monthValue}
            onValueChange={(value) => {
              if (value === null) return;
              setMonthValue(value);
            }}
            multiple={false}
          />
        </View>
        <Button
          onPress={() => open({ year: Number(yearText), month: Number(monthValue) })}
          accessibilityLabel={t('agenda_go_to_date')}
          style={styles.lookupGo}
        >
          <Ionicons name="search-outline" size={20} color={colors.onPrimary} />
        </Button>
      </View>
    </View>
  );
});

export default StoryAgendaScreen;
