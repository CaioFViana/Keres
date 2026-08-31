import type { CalendarDefinitionType } from '@keres/shared';
import { buildCalendarAnchorPreview } from '../../src/utils/calendarAnchorPreview';

const calendar = (firstMonthDays: number): CalendarDefinitionType => ({
  months: [
    { name: 'First', days: firstMonthDays },
    { name: 'Second', days: 40 },
  ],
  daysPerWeek: 0,
  weekdayNames: [],
  hoursPerDay: 24,
  minutesPerHour: 60,
  secondsPerMinute: 60,
  eras: [],
  seasons: [],
  moons: [],
  unitNames: {},
});

describe('buildCalendarAnchorPreview', () => {
  it('keeps the anchored story-time point while a changed calendar reinterprets its date', () => {
    const inputs = {
      story: { timelineEpochDay: 0, timelineEpochSeconds: 0 } as never,
      chapters: [
        { id: 'chapter', name: 'Act one', type: 'chapter', index: 1, isDeleted: false },
      ] as never,
      scenes: [
        {
          id: 'start',
          storyId: 'story',
          chapterId: 'chapter',
          name: 'Opening',
          index: 1,
          duration: 30,
          durationType: 'days',
          gap: null,
          gapType: null,
          isDeleted: false,
        },
        {
          id: 'arrival',
          storyId: 'story',
          chapterId: 'chapter',
          name: 'Arrival',
          index: 2,
          duration: 0,
          durationType: 'days',
          gap: 1,
          gapType: 'days',
          isDeleted: false,
        },
      ] as never,
      anchors: [
        {
          id: 'anchor',
          chapterId: 'chapter',
          startSceneId: 'arrival',
          startPosition: 'start',
          startOffset: null,
          startOffsetUnit: null,
          endSceneId: null,
          endPosition: null,
          endOffset: null,
          endOffsetUnit: null,
          isDeleted: false,
        },
      ] as never,
    };

    const original = buildCalendarAnchorPreview({ ...inputs, definition: calendar(30) });
    const changed = buildCalendarAnchorPreview({ ...inputs, definition: calendar(20) });

    expect(original.find((row) => row.id === 'anchor:start')?.date).toBe('2 Second, 1 · 00:00');
    expect(changed.find((row) => row.id === 'anchor:start')?.date).toBe('12 Second, 1 · 00:00');
  });

  it('does not manufacture a date before the story opening is anchored', () => {
    const rows = buildCalendarAnchorPreview({
      story: { timelineEpochDay: null, timelineEpochSeconds: null } as never,
      chapters: [
        { id: 'chapter', name: 'Act one', type: 'chapter', index: 1, isDeleted: false },
      ] as never,
      scenes: [
        {
          id: 'scene',
          storyId: 'story',
          chapterId: 'chapter',
          name: 'Opening',
          index: 1,
          isDeleted: false,
        },
      ] as never,
      anchors: [
        {
          id: 'anchor',
          chapterId: 'chapter',
          startSceneId: 'scene',
          startPosition: 'start',
          startOffset: null,
          startOffsetUnit: null,
          endSceneId: null,
          endPosition: null,
          endOffset: null,
          endOffsetUnit: null,
          isDeleted: false,
        },
      ] as never,
      definition: calendar(30),
    });

    expect(rows).toEqual([expect.objectContaining({ id: 'anchor:start', date: null })]);
  });
});
