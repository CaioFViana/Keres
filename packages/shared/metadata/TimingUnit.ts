/**
 * The vocabulary a duration can be written in, longest first.
 *
 * It lives in `metadata` rather than beside the calendar arithmetic because both the schema (which
 * lets a calendar rename these) and the arithmetic (which measures them) need it, and having either
 * own it would make the two import each other.
 *
 * The list is fixed. A calendar changes what a unit is *worth* and what it is *called*; it does not
 * add units, because every graph, formatter and form in the app is written against these nine.
 */
export const TIMING_UNITS = [
  'eons',
  'millennia',
  'years',
  'months',
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
] as const;

export type TimingUnit = (typeof TIMING_UNITS)[number];
