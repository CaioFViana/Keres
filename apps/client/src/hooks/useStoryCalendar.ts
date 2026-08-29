import type { CalendarDefinitionType } from '@keres/shared';
import {
  calendarMoonPhases,
  calendarSeasonFor,
  dayNumberToParts,
  formatCalendarDate,
} from '@keres/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { StoryCalendarSelect } from '@/src/db/schema';
import { createStoryCalendarService } from '@/src/services/storymanagement/StoryCalendarService';
import { useStoryStore } from '@/src/state/storyStore';
import { entityEventEmitter } from '@/src/utils/EventEmitter';
import { useEntityInitialLoad } from '@/src/hooks/useEntityRefreshLifecycle';

/**
 * The selected story's calendars, and the one the app measures with.
 *
 * Every screen that formats a duration needs the primary definition and nothing else, so that is
 * what this returns first. `null` means the story has no calendar, which the timing helpers read as
 * "use the Gregorian averages" - the app's behaviour before this feature, and the right answer for
 * a story that never asked for another one.
 */
export function useStoryCalendar(storyIdOverride?: string) {
  const db = useDrizzle();
  const selectedStory = useStoryStore((state) => state.selectedStory);
  const storyId = storyIdOverride ?? selectedStory?.id;
  const [calendars, setCalendars] = useState<StoryCalendarSelect[]>([]);
  const [definition, setDefinition] = useState<CalendarDefinitionType | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!storyId) {
      setCalendars([]);
      setDefinition(null);
      setPrimaryId(null);
      setLoading(false);
      return;
    }
    const service = createStoryCalendarService(db);
    const [all, primary] = await Promise.all([
      service.getCalendarsForStory(storyId),
      service.getPrimary(storyId),
    ]);
    setCalendars(all);
    setDefinition(primary?.definition ?? null);
    setPrimaryId(primary?.id ?? null);
    setLoading(false);
  }, [db, storyId]);

  useEntityInitialLoad(reload);

  useEffect(() => {
    // A calendar edited on another screen changes every duration on this one, so the refresh is
    // driven by the same event the sync handlers emit rather than by a focus listener.
    const listener = () => void reload();
    entityEventEmitter.on('story_calendar_changed', listener);
    return () => {
      entityEventEmitter.off('story_calendar_changed', listener);
    };
  }, [reload]);

  // `all` and `primary` above are separate database reads. Their JSON definitions may have equal
  // contents but are not necessarily the same JavaScript object, so reference equality made the
  // main calendar disappear from the UI. Identity is the persisted calendar id.
  const primary = useMemo(
    () => calendars.find((calendar) => calendar.id === primaryId),
    [calendars, primaryId],
  );

  /*
   * A day, said in full: the date, the season it falls in, and where each moon is.
   *
   * The season and the moons are read-only derivations - nothing is ever *written* in them - which
   * is why they cost two pure functions rather than a second time system. A calendar that declares
   * neither simply returns neither, and the caller renders nothing extra.
   */
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

  return { calendars, definition, primary, loading, reload, describeDay };
}
