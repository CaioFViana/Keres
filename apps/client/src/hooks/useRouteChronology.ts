import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStoryRoutes } from '@/src/hooks/useStoryRoutes';
import { useStoryCalendar } from '@/src/hooks/useStoryCalendar';
import { useStoryStore } from '@/src/state/storyStore';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import {
  buildRouteChronology,
  calendarSecondsPerDay,
  dayNumberForElapsed,
  formatCalendarDate,
  formatGregorianDate,
  gregorianDayNumber,
  gregorianDayNumberForElapsed,
  gregorianPartsFromDayNumber,
  isCalendarDateCoordinateInBounds,
  parseCalendarDateCoordinate,
  partsToDayNumber,
} from '@keres/shared';
import type { StoryTimelineScaleMode } from '@keres/shared/graphs/storyTimelineLayout';

const timeFor = (
  hoursPerDay: number,
  minutesPerHour: number,
  secondsPerMinute: number,
  seconds: number,
) => {
  const perDay = hoursPerDay * minutesPerHour * secondsPerMinute;
  const withinDay = ((Math.floor(seconds) % perDay) + perDay) % perDay;
  const hour = Math.floor(withinDay / (minutesPerHour * secondsPerMinute));
  const minute = Math.floor((withinDay % (minutesPerHour * secondsPerMinute)) / secondsPerMinute);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

/**
 * Gives a saved Route the same time interpretation as Story Timeline, without making that route a
 * global chronology. All output is derived and is keyed by RouteStep id, so loops remain visible.
 */
export function useRouteChronology(routeId: string, scaleMode: StoryTimelineScaleMode = 'compact') {
  const { t } = useTranslation();
  const story = useStoryStore((state) => state.selectedStory);
  const dateDisplayFormat = useUserSettingsStore((state) => state.dateDisplayFormat);
  const { definition: calendar, calendars } = useStoryCalendar();
  const routes = useStoryRoutes(story?.id);
  const route = routes.routes.find((candidate) => candidate.id === routeId);
  const steps = routes.stepsOf(routeId);
  const validation = routes.validationOf(routeId);

  const overrides = useMemo(() => {
    const epochDay = story?.timelineEpochDay;
    if (epochDay === null || epochDay === undefined || !calendar) return {};
    const currentSecondsPerDay = calendarSecondsPerDay(calendar);
    return Object.fromEntries(
      routes.scenes.flatMap((scene) => {
        const coordinate = parseCalendarDateCoordinate(scene.calendarDateOverride);
        const source = scene.calendarDateOverrideCalendarId
          ? calendars.find((candidate) => candidate.id === scene.calendarDateOverrideCalendarId)
              ?.definition
          : null;
        if (!coordinate || (source && !isCalendarDateCoordinateInBounds(source, coordinate)))
          return [];
        const day = source ? partsToDayNumber(source, coordinate) : gregorianDayNumber(coordinate);
        const sourceSecondsPerDay = source ? calendarSecondsPerDay(source) : 86_400;
        const timeFraction =
          (coordinate.hour * (source?.minutesPerHour ?? 60) * (source?.secondsPerMinute ?? 60) +
            coordinate.minute * (source?.secondsPerMinute ?? 60)) /
          sourceSecondsPerDay;
        return [
          [
            scene.id,
            (day - epochDay) * currentSecondsPerDay +
              timeFraction * currentSecondsPerDay -
              (story?.timelineEpochSeconds ?? 0),
          ],
        ];
      }),
    );
  }, [calendar, calendars, routes.scenes, story?.timelineEpochDay, story?.timelineEpochSeconds]);

  const layout = useMemo(
    () =>
      buildRouteChronology(steps, routes.scenes, {
        calendar,
        scaleMode,
        chapterNameOf: (chapterId) => routes.chapterNameOf(chapterId) ?? t('common_na'),
        sceneElapsedOverrides: overrides,
      }),
    [calendar, overrides, routes, scaleMode, steps, t],
  );

  const dateForRow = useCallback(
    (elapsedSeconds: number) => {
      const epochDay = story?.timelineEpochDay;
      if (epochDay === null || epochDay === undefined) return null;
      const epochSeconds = story?.timelineEpochSeconds ?? 0;
      if (!calendar) {
        return `${formatGregorianDate(gregorianPartsFromDayNumber(gregorianDayNumberForElapsed(epochDay, elapsedSeconds, epochSeconds)), dateDisplayFormat)} · ${timeFor(24, 60, 60, epochSeconds + elapsedSeconds)}`;
      }
      return `${formatCalendarDate(calendar, dayNumberForElapsed(calendar, epochDay, elapsedSeconds, epochSeconds))} · ${timeFor(calendar.hoursPerDay, calendar.minutesPerHour, calendar.secondsPerMinute, epochSeconds + elapsedSeconds)}`;
    },
    [calendar, dateDisplayFormat, story?.timelineEpochDay, story?.timelineEpochSeconds],
  );

  const sceneForStep = useCallback(
    (stepId: string) => {
      const step = steps.find((candidate) => candidate.id === stepId);
      return step ? routes.sceneById(step.sceneId) : undefined;
    },
    [routes, steps],
  );

  return { ...routes, story, route, steps, validation, layout, dateForRow, sceneForStep };
}
