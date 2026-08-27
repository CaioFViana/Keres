import { z } from 'zod';
import { TIMING_UNITS } from '../metadata/TimingUnit';

/**
 * A calendar the story counts time in.
 *
 * ## Why the whole definition is one JSON column
 *
 * Months, weekdays, eras, moons and seasons are ordered lists belonging to one calendar. Modelled
 * relationally they would be five more entities inside the sync engine - five handlers on each side,
 * five operation-log entity types, five conflict stories, five sets of migrations.
 *
 * They are also never edited independently. A writer opens a calendar, sets it up, and rarely
 * returns; renaming the third month is not a change anyone needs merged separately from renaming the
 * fourth. Last-write-wins over the whole definition is the right conflict behaviour for an object
 * edited as a unit, and it is what the engine already does for every other column.
 *
 * ## What a calendar is not
 *
 * It is never storage. Nothing in Keres stores a date: a scene stores a number and a unit, an anchor
 * stores a scene and an offset. A calendar is a function from a day number to a label and back,
 * which is why adding, editing or deleting one cannot invalidate anything already written.
 */

/**
 * A month, and how many days are in it. Integer lengths only - see `CalendarDefinitionSchema`.
 *
 * The name may be empty, and that is not laxity: a month is identified by its position, the name is
 * a convenience, and everything that renders one already falls back to its number when it is blank
 * (`formatCalendarDate`, the agenda's grid, `StoryDateInput`). Requiring a name here made the
 * calendar form throw on mount, because a form that starts with two blank months is the only
 * sensible thing for it to start with.
 */
export const CalendarMonthSchema = z.object({
  name: z.string().max(60),
  days: z.number().int().min(1).max(1000),
});

/**
 * A named span of years, counted from `startYear`.
 *
 * The displayed year is `year - startYear + 1`, so an era beginning at absolute year 1 renders
 * absolute years unchanged. A story with no eras shows the absolute year alone.
 */
export const CalendarEraSchema = z.object({
  name: z.string().min(1).max(80),
  abbreviation: z.string().min(1).max(12),
  startYear: z.number().int(),
});

/**
 * A moon, as a period and a day it was new on.
 *
 * `periodDays` is deliberately fractional: real satellites do not have integer periods and an
 * invented one need not either. Nothing is ever *written* in moons (see the module docs on
 * `storyCalendar.ts`), so a fractional period never enters an arithmetic that has to stay exact.
 */
export const CalendarMoonSchema = z.object({
  name: z.string().min(1).max(60),
  periodDays: z.number().positive().max(1_000_000),
  /** An absolute day number on which this moon was new. */
  referenceDay: z.number().int(),
});

/** A season, as the day of the year it starts on. 1 is the first day of the year. */
export const CalendarSeasonSchema = z.object({
  name: z.string().min(1).max(60),
  startDayOfYear: z.number().int().min(1),
});

/**
 * Everything the app needs to do a story's calendar arithmetic.
 *
 * The sub-day ratios are here for the same reason the others are: the carry table in `sceneTiming`
 * is being sourced from this object regardless, so the hour and the minute are lookups replacing
 * literals rather than a new mechanism. A story that leaves them alone keeps 60/60/24.
 *
 * `daysPerYear` is deliberately absent - it is derived by summing the months. A stored total that
 * disagrees with the months it is supposed to total is a bug waiting to happen.
 */
export const CalendarDefinitionSchema = z
  .object({
    secondsPerMinute: z.number().int().min(1).max(1000).default(60),
    minutesPerHour: z.number().int().min(1).max(1000).default(60),
    hoursPerDay: z.number().int().min(1).max(1000).default(24),
    daysPerWeek: z.number().int().min(1).max(100).default(7),
    weekdayNames: z.array(z.string().min(1).max(60)).default([]),
    /**
     * What this world calls each duration unit, for the ones it renames.
     *
     * Partial on purpose: a story that calls a week a *ciclo* and leaves everything else alone
     * states one entry. Anything absent falls back to the app's own translated word.
     */
    unitNames: z.partialRecord(z.enum(TIMING_UNITS), z.string().min(1).max(40)).default({}),
    months: z.array(CalendarMonthSchema).min(1),
    eras: z.array(CalendarEraSchema).default([]),
    moons: z.array(CalendarMoonSchema).default([]),
    seasons: z.array(CalendarSeasonSchema).default([]),
  })
  .superRefine((definition, context) => {
    /*
     * A week whose names do not match its length would render a grid with blank or orphaned columns.
     * An empty list is allowed and means "this calendar does not name its days".
     */
    if (
      definition.weekdayNames.length > 0 &&
      definition.weekdayNames.length !== definition.daysPerWeek
    ) {
      context.addIssue({
        code: 'custom',
        path: ['weekdayNames'],
        message: `A calendar with ${definition.daysPerWeek} days per week needs that many names, or none at all.`,
      });
    }

    // Integer years are what keeps every conversion in this feature integer arithmetic. See §12 of
    // the plan: leap rules are excluded, and a fractional year is the thing that would require them.
    const daysPerYear = definition.months.reduce((total, month) => total + month.days, 0);

    for (const [index, season] of definition.seasons.entries()) {
      if (season.startDayOfYear > daysPerYear) {
        context.addIssue({
          code: 'custom',
          path: ['seasons', index, 'startDayOfYear'],
          message: `The year is ${daysPerYear} days long, so it has no day ${season.startDayOfYear}.`,
        });
      }
    }
  });

export const StoryCalendarSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string().min(1).max(120),
  /** The one the graphs render in, and the one whose units durations are written in. */
  isPrimary: z.boolean(),
  description: z.string().nullable(),
  definition: CalendarDefinitionSchema,
  extraNotes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateStoryCalendarDataSchema = z.object({
  name: z.string().min(1).max(120),
  isPrimary: z.boolean().default(false),
  description: z.string().nullable().default(null),
  definition: CalendarDefinitionSchema,
  extraNotes: z.string().nullable().default(null),
});

export const PartialStoryCalendarSchema = CreateStoryCalendarDataSchema.partial();

export type CalendarMonthType = z.infer<typeof CalendarMonthSchema>;
export type CalendarEraType = z.infer<typeof CalendarEraSchema>;
export type CalendarMoonType = z.infer<typeof CalendarMoonSchema>;
export type CalendarSeasonType = z.infer<typeof CalendarSeasonSchema>;
export type CalendarDefinitionType = z.infer<typeof CalendarDefinitionSchema>;
export type StoryCalendarRowType = z.infer<typeof StoryCalendarSchema>;
export type CreateStoryCalendarDataType = z.infer<typeof CreateStoryCalendarDataSchema>;
export type PartialStoryCalendarType = z.infer<typeof PartialStoryCalendarSchema>;
