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
import Select from '@/src/components/common/inputs/Select/Select';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';

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
  const [yearText, setYearText] = useState('1');
  const [monthText, setMonthText] = useState('1');

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

  // Keep the date controls in step with scene/event navigation, while still allowing the writer to
  // type an arbitrary year and then explicitly open that month.
  useEffect(() => {
    if (!definition || cursor === null) return;
    const parts = dayNumberToParts(definition, cursor);
    setYearText(String(parts.year));
    setMonthText(String(parts.month));
  }, [cursor, definition]);

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
        lookup: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderRadius: 8,
          padding: 10,
          marginBottom: 14,
        },
        lookupTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
        lookupRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, zIndex: 2 },
        lookupField: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
        lookupLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 3 },
        lookupInput: {
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          borderRadius: 6,
          paddingHorizontal: 9,
          paddingVertical: 8,
          minHeight: 40,
        },
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
  const openChosenMonth = () => {
    const year = Number(yearText);
    const monthIndex = Number(monthText);
    if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) return;
    setCursor(partsToDayNumber(definition, { year, month: monthIndex, day: 1 }));
  };

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

        <View style={styles.lookup}>
          <Text style={styles.lookupTitle}>{t('agenda_go_to_date')}</Text>
          {definition.eras.length > 0 && (
            <View style={{ marginBottom: 8, zIndex: 3 }}>
              <Text style={styles.lookupLabel}>{t('calendar_eras')}</Text>
              <Select
                options={definition.eras.map((era, index) => ({
                  label: `${era.name} (${era.abbreviation})`,
                  value: String(index),
                }))}
                value={null}
                onValueChange={(eraIndex) => {
                  if (eraIndex === null) return;
                  const era = definition.eras[Number(eraIndex)];
                  if (!era) return;
                  const year = era.direction === 'backward' ? era.startYear - 1 : era.startYear;
                  setYearText(String(year));
                  setCursor(partsToDayNumber(definition, {
                    year,
                    month: Number(monthText) || 1,
                    day: 1,
                  }));
                }}
                placeholder={t('agenda_pick_era')}
                multiple={false}
              />
            </View>
          )}
          <View style={styles.lookupRow}>
            <View style={styles.lookupField}>
              <Text style={styles.lookupLabel}>{t('calendar_epoch_year')}</Text>
              <TextInput
                value={yearText}
                onChangeText={(text) => {
                  if (!text || /^-?\d*$/.test(text)) setYearText(text);
                }}
                keyboardType="numbers-and-punctuation"
                style={styles.lookupInput}
              />
            </View>
            <View style={styles.lookupField}>
              <Text style={styles.lookupLabel}>{t('calendar_epoch_month')}</Text>
              <Select
                options={definition.months.map((month, index) => ({
                  label: month.name || String(index + 1),
                  value: String(index + 1),
                }))}
                value={monthText}
                onValueChange={(month) => month !== null && setMonthText(month)}
                multiple={false}
              />
            </View>
            <TouchableOpacity
              style={styles.navButton}
              onPress={openChosenMonth}
              accessibilityRole="button"
              accessibilityLabel={t('agenda_go_to_date')}
            >
              <Text style={styles.navText}>{t('agenda_go')}</Text>
            </TouchableOpacity>
          </View>
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
