import { CalendarDefinitionSchema } from '@keres/shared';
import { sceneFixedDate } from '@/src/utils/scene/sceneFixedDate';

const lunar = {
  id: 'lunar',
  name: 'Lunar',
  definition: CalendarDefinitionSchema.parse({
    daysPerWeek: 4,
    weekdayNames: ['Ash', 'Bone', 'Clay', 'Dusk'],
    months: Array.from({ length: 13 }, (_, index) => ({ name: `L${index + 1}`, days: 28 })),
  }),
};

const options = {
  calendars: [lunar],
  language: 'en',
  format: 'iso' as const,
  labels: { gregorian: 'Gregorian', notValid: 'not valid' },
};

describe('sceneFixedDate', () => {
  it('has nothing for a scene without a fixed date', () => {
    expect(sceneFixedDate({ calendarDateOverride: null }, options)).toBeNull();
    expect(sceneFixedDate({ calendarDateOverride: '' }, options)).toBeNull();
    expect(sceneFixedDate({ calendarDateOverride: '   ' }, options)).toBeNull();
    expect(sceneFixedDate({}, options)).toBeNull();
  });

  it('writes a date in its custom calendar, with the time and the calendar’s name', () => {
    expect(
      sceneFixedDate(
        { calendarDateOverride: '0003-02-06T07:08', calendarDateOverrideCalendarId: 'lunar' },
        options,
      ),
    ).toEqual({ text: '6 L2, 3 · 07:08 · Lunar', valid: true });
  });

  it('writes a date saved without a calendar as Gregorian, in the user’s format', () => {
    expect(sceneFixedDate({ calendarDateOverride: '2023-01-31T10:00' }, options)).toEqual({
      text: '2023-01-31 · 10:00 · Gregorian',
      valid: true,
    });
    expect(
      sceneFixedDate({ calendarDateOverride: '2023-01-31T10:00' }, { ...options, format: 'dmy' }),
    ).toEqual({ text: '31/01/2023 · 10:00 · Gregorian', valid: true });
  });

  it('shows text that is not a date as saved, marked', () => {
    expect(sceneFixedDate({ calendarDateOverride: 'Day 12' }, options)).toEqual({
      text: 'Day 12 (not valid)',
      valid: false,
    });
  });

  it('shows a date its calendar no longer has as saved, marked', () => {
    expect(
      sceneFixedDate(
        { calendarDateOverride: '0003-14-06T07:08', calendarDateOverrideCalendarId: 'lunar' },
        options,
      ),
    ).toEqual({ text: '0003-14-06T07:08 (not valid)', valid: false });
    expect(sceneFixedDate({ calendarDateOverride: '2023-02-30T10:00' }, options)).toEqual({
      text: '2023-02-30T10:00 (not valid)',
      valid: false,
    });
  });

  it('does not guess the calendar of a date whose calendar is gone', () => {
    expect(
      sceneFixedDate(
        { calendarDateOverride: '0003-02-06T07:08', calendarDateOverrideCalendarId: 'deleted' },
        options,
      ),
    ).toEqual({ text: '0003-02-06T07:08 (not valid)', valid: false });
  });
});
