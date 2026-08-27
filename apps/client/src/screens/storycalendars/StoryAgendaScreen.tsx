import { Ionicons } from '@expo/vector-icons';
import { dayNumberToParts, partsToDayNumber } from '@keres/shared';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useStoryAgenda } from '@/src/hooks/useStoryAgenda';
import { useStoryCalendar } from '@/src/hooks/useStoryCalendar';
import type { CustomizationStackParamList } from '@/src/navigation/MainSystemStack';
import { useStoryStore } from '@/src/state/storyStore';
import { useTheme } from '@/src/theme';
import { setDocumentTitle } from '@/src/utils/documentTitle';

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
  const { definition, describeDay } = useStoryCalendar(story?.id);
  const navigation =
    useNavigation<NativeStackNavigationProp<CustomizationStackParamList, 'StoryAgenda'>>();
  const { entries, loading } = useStoryAgenda();
  const [cursor, setCursor] = useState<number | null>(null);

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
        content: { padding: 12, paddingBottom: 40 },
        message: { padding: 28, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
        header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
        monthLabel: {
          flexGrow: 1,
          flexShrink: 1,
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
        },
        nav: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
        navButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 7,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
        },
        navText: { fontSize: 12, fontWeight: '700', color: colors.primary },
        week: { flexDirection: 'row' },
        weekdayCell: {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          alignItems: 'center',
          paddingBottom: 4,
        },
        weekdayText: { fontSize: 10, color: colors.textSecondary, fontWeight: '700' },
        cell: {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          minHeight: 62,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 3,
        },
        cellToday: { backgroundColor: colors.primaryContainer },
        cellDay: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
        cellEntry: { fontSize: 9, color: colors.text, marginTop: 1 },
        aside: { fontSize: 12, color: colors.textSecondary, marginTop: 12, lineHeight: 18 },
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
  const offset =
    definition.weekdayNames.length > 0
      ? ((firstOfMonth % definition.daysPerWeek) + definition.daysPerWeek) % definition.daysPerWeek
      : 0;
  let week: (number | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 0; day < month.days; day += 1) {
    week.push(firstOfMonth + day);
    if (week.length === definition.daysPerWeek) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < definition.daysPerWeek) week.push(null);
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

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
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
            {row.map((day, cellIndex) => (
              <View
                key={day ?? `blank-${cellIndex}`}
                style={[styles.cell, day === cursor && styles.cellToday]}
              >
                {day !== null && (
                  <>
                    <Text style={styles.cellDay}>{dayNumberToParts(definition, day).day}</Text>
                    {(byDay.get(day) ?? []).slice(0, 3).map((entry) => (
                      <Text key={entry.id} numberOfLines={1} style={styles.cellEntry}>
                        {entry.kind === 'event' ? '◆ ' : ''}
                        {entry.name}
                      </Text>
                    ))}
                  </>
                )}
              </View>
            ))}
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
      </ScrollView>
    </View>
  );
};

export default StoryAgendaScreen;
