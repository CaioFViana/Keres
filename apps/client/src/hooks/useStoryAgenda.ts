import type { CalendarDefinitionType } from '@keres/shared';
import { dayNumberForElapsed, gregorianDayNumberForElapsed } from '@keres/shared';
import { useMemo } from 'react';
import { useStoryTimeline } from './useStoryTimeline';
import { useStoryStore } from '@/src/state/storyStore';

/** One thing that happens on a day: a scene of the spine, or an anchored event. */
export interface AgendaEntry {
  id: string;
  name: string;
  kind: 'scene' | 'event';
  dayNumber: number;
  summary?: string | null;
}

/**
 * What happens on each day of the story's calendar.
 *
 * Built on `useStoryTimeline` rather than on its own queries, and that is the point: the timeline
 * has already resolved every scene's elapsed time and every event's anchor to a position on one
 * measured axis. Converting those to day numbers is a change of unit, so the agenda cannot disagree
 * with the drawing - which it would, sooner or later, if it walked the gaps a second time.
 *
 * Empty only when the story has no epoch. No custom primary means the built-in Gregorian calendar.
 */
export function useStoryAgenda(definition?: CalendarDefinitionType | null) {
  const story = useStoryStore((state) => state.selectedStory);
  const { layout, loading, scenes } = useStoryTimeline(definition);

  const entries = useMemo<AgendaEntry[]>(() => {
    const epochDay = story?.timelineEpochDay;
    if (epochDay === null || epochDay === undefined) return [];

    const summaries = new Map(scenes.map((scene) => [scene.id, scene.summary]));
    const epochSeconds = story?.timelineEpochSeconds ?? 0;
    const sceneEntries = layout.rows
      .filter((row) => row.elapsedSeconds !== undefined)
      .map((row) => ({
        id: row.id,
        name: row.name,
        kind: 'scene' as const,
        dayNumber: definition
          ? dayNumberForElapsed(definition, epochDay, row.elapsedSeconds ?? 0, epochSeconds)
          : gregorianDayNumberForElapsed(epochDay, row.elapsedSeconds ?? 0, epochSeconds),
        summary: summaries.get(row.id) ?? null,
      }));

    /*
     * An event lands on the day its first stretch begins.
     *
     * A band covering three months would otherwise fill three months of cells with the same name,
     * which is noise: the agenda answers "what happens today", and an era that is merely still
     * running is not news on any particular day.
     */
    const seen = new Set<string>();
    const events = layout.eventSpans
      .filter((span) => span.isEvent && !seen.has(span.id) && seen.add(span.id))
      .map((span) => {
        const row = layout.rows.find((candidate) => candidate.barStart >= span.start);
        return {
          id: span.id,
          name: span.name,
          kind: 'event' as const,
          dayNumber: definition
            ? dayNumberForElapsed(definition, epochDay, row?.elapsedSeconds ?? 0, epochSeconds)
            : gregorianDayNumberForElapsed(epochDay, row?.elapsedSeconds ?? 0, epochSeconds),
        };
      });

    return [...sceneEntries, ...events].sort((a, b) => a.dayNumber - b.dayNumber);
  }, [definition, layout, scenes, story?.timelineEpochDay, story?.timelineEpochSeconds]);

  return { entries, loading };
}
