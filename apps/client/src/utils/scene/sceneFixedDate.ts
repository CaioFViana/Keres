import {
  type CalendarDefinitionType,
  type GregorianDateDisplayFormat,
  parseCalendarDateCoordinate,
} from '@keres/shared';
import { coordinateExists, describeCoordinate } from '@/src/utils/calendar/calendarDateFields';

export interface SceneFixedDate {
  /** The date as the calendar writes it, with the time and the calendar's name. */
  text: string;
  /** Whether it exists in its calendar: only a valid one places the scene on the timeline. */
  valid: boolean;
}

interface Options {
  calendars: { id: string; name: string; definition: CalendarDefinitionType }[];
  language: string;
  format: GregorianDateDisplayFormat;
  /** What the Gregorian calendar is called, and what is said of a date its calendar lacks. */
  labels: { gregorian: string; notValid: string };
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * A scene's fixed date as the detail screen shows it, or `null` when it has none.
 *
 * It is shown whatever the story's timeline looks like: whether the date can place the scene is a
 * separate matter (it needs a start date), and a date nobody can see cannot be corrected. One that is
 * not valid - text that is not a date, or a day a later calendar edit removed - is shown as saved and
 * marked, instead of disappearing.
 */
export function sceneFixedDate(
  scene: { calendarDateOverride?: string | null; calendarDateOverrideCalendarId?: string | null },
  { calendars, language, format, labels }: Options,
): SceneFixedDate | null {
  const raw = scene.calendarDateOverride?.trim();
  if (!raw) return null;
  const invalid = { text: `${raw} (${labels.notValid})`, valid: false };

  const coordinate = parseCalendarDateCoordinate(raw);
  if (!coordinate) return invalid;

  const calendarId = scene.calendarDateOverrideCalendarId ?? null;
  const calendar = calendarId ? calendars.find((candidate) => candidate.id === calendarId) : null;
  // A calendar that is gone (or not loaded yet) cannot write the date: say so rather than guess.
  if (calendarId && !calendar) return invalid;

  const definition = calendar?.definition ?? null;
  if (!coordinateExists(definition, coordinate)) return invalid;

  const { date } = describeCoordinate(definition, coordinate, language, format);
  return {
    text: `${date} · ${pad(coordinate.hour)}:${pad(coordinate.minute)} · ${calendar?.name ?? labels.gregorian}`,
    valid: true,
  };
}
