import type { CalendarDefinitionType } from '../schemas/StoryCalendarSchemas';

/** A calendar the story counts time in. See `StoryCalendarSchemas.ts`. */
export interface StoryCalendar {
  id: string;
  storyId: string;
  name: string;
  /** The one the graphs render in, and the one whose units durations are written in. */
  isPrimary: boolean;
  description: string | null;
  definition: CalendarDefinitionType;
  extraNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
