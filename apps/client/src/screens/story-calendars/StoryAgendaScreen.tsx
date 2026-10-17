import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import {
  calendarMoonPhases,
  calendarSeasonFor,
  dayNumberToParts,
  formatCalendarDate,
  formatGregorianDate,
  gregorianDayNumber,
  gregorianPartsFromDayNumber,
  partsToDayNumber,
} from '@keres/shared';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useStoryAgenda } from '@/src/screens/story-calendars/useStoryAgenda';
import { useStoryCalendar } from '@/src/hooks/story/useStoryCalendar';
import type { CalendarsStackParamList } from '@/src/navigation/stacks/CalendarsStack';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { useTheme } from '@/src/theme';
import { useNavigateToEntityDetail } from '@/src/hooks/nav/useNavigateToEntityDetail';
import CalendarMonthGrid from '@/src/components/features/calendars/CalendarMonthGrid/CalendarMonthGrid';
import { dayNumberOf, dayPartsOf, shiftMonth } from '@/src/utils/calendar/calendarMonthGrid';
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
 * ## Why it benefits from the epoch
 *
 * Without one no scene has an absolute day, so nothing can be placed. The grid remains useful,
 * though: a parallel calendar still needs to be browsed and consulted before the writer anchors
 * the story on it.
 */
const StoryAgendaScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const story = useStoryStore((state) => state.selectedStory);
  const dateDisplayFormat = useUserSettingsStore((state) => state.dateDisplayFormat);
  const { calendars, definition: primaryDefinition } = useStoryCalendar(story?.id);
  const route = useRoute<RouteProp<CalendarsStackParamList, 'StoryAgenda'>>();
  const definition = useMemo(() => {
    const requestedId = route.params?.calendarId;
    return requestedId
      ? (calendars.find((calendar) => calendar.id === requestedId)?.definition ?? null)
      : primaryDefinition;
  }, [calendars, primaryDefinition, route.params?.calendarId]);
  const navigation =
    useNavigation<NativeStackNavigationProp<CalendarsStackParamList, 'StoryAgenda'>>();
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

  useScreenHeader({
    target: 'parent',
    title: t('agenda_title'),
  });

  // Opens on the month holding the first thing that happens, not on year one. A calendar without
  // an epoch is still browseable; begin it at its own year one rather than hiding its viewer.
  if (cursor === null) {
    if (entries.length > 0) {
      setCursor(entries[0].dayNumber);
    } else {
      setCursor(
        definition
          ? partsToDayNumber(definition, { year: 1, month: 1, day: 1 })
          : gregorianDayNumber({ year: 1, month: 1, day: 1 }),
      );
    }
  }

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
          // `TextInput` already applies the shared input style. Do not override its border here:
          // doing so made Year look like an unstyled browser field until hover/focus on web.
          marginBottom: 0,
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
          marginBottom: 10,
        },
        eventBadge: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
      }),
    [colors],
  );

  if (loading || cursor === null)
    return (
      <View style={styles.root}>
        <Text style={styles.message}>{loading ? t('loading') : t('agenda_nothing_placed')}</Text>
      </View>
    );

  const cursorParts = dayPartsOf(definition, cursor);

  const jump = (direction: 1 | -1, kind?: 'event') => {
    const candidates = entries
      .filter((entry) => (kind ? entry.kind === kind : true))
      .map((entry) => entry.dayNumber)
      .filter((day) => (direction === 1 ? day > cursor : day < cursor))
      .sort((a, b) => (direction === 1 ? a - b : b - a));
    if (candidates.length > 0) setCursor(candidates[0]);
  };

  const shiftCursorMonth = (direction: 1 | -1) => {
    const next = shiftMonth(definition, cursorParts.year, cursorParts.month, direction);
    setCursor(dayNumberOf(definition, { ...next, day: 1 }));
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

        {(story?.timelineEpochDay === null || story?.timelineEpochDay === undefined) && (
          <TouchableOpacity onPress={() => navigation.navigate('StoryCalendarList')}>
            <Text style={[styles.aside, { color: colors.textSecondary, marginTop: 0 }]}>
              {t('agenda_no_epoch')}
            </Text>
          </TouchableOpacity>
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

        <CalendarMonthGrid
          calendar={definition}
          year={cursorParts.year}
          month={cursorParts.month}
          selectedDay={cursor}
          onSelectDay={setCursor}
          onShiftMonth={shiftCursorMonth}
          entriesByDay={byDay}
          describeDay={(day) => describeDay(day)?.date}
        />

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
