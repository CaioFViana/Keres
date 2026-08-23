import { buildStoryTimelineLayout } from '../../src/utils/storyTimelineLayout';

const scene = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  chapterId: 'chapter',
  chapterName: 'Chapter',
  chapterColor: '#123456',
  index: 0,
  ...extra,
});

describe('story timeline layout', () => {
  it('keeps scene order and does not plot the first selected scene gap', () => {
    const layout = buildStoryTimelineLayout([
      scene('first', { gap: 1000, gapType: 'years', duration: 1, durationType: 'hours' }),
      scene('second', { gap: 2, gapType: 'days', duration: 1, durationType: 'hours' }),
    ]);

    expect(layout.rows.map((row) => row.id)).toEqual(['first', 'second']);
    expect(layout.rows[0].gap).toBeUndefined();
    expect(layout.rows[1].gap?.value).toBe(2);
    expect(layout.rows[1].barStart).toBeGreaterThan(layout.rows[0].barEnd);
  });

  it('uses a bounded compact distance while preserving large-unit ordering', () => {
    const layout = buildStoryTimelineLayout([
      scene('short', { duration: 1, durationType: 'seconds' }),
      scene('long', { duration: 1000, durationType: 'years' }),
    ]);
    const shortWidth = Math.abs(layout.rows[0].barEnd - layout.rows[0].barStart);
    const longWidth = Math.abs(layout.rows[1].barEnd - layout.rows[1].barStart);

    expect(longWidth).toBeGreaterThan(shortWidth);
    expect(longWidth).toBeLessThan(2_000);
  });

  it('preserves linear duration ratios in proportional mode', () => {
    const layout = buildStoryTimelineLayout(
      [
        scene('minutes', { duration: 10, durationType: 'minutes' }),
        scene('hours', { duration: 5, durationType: 'hours' }),
      ],
      'proportional',
    );
    const minutesWidth = Math.abs(layout.rows[0].barEnd - layout.rows[0].barStart);
    const hoursWidth = Math.abs(layout.rows[1].barEnd - layout.rows[1].barStart);

    expect(hoursWidth / minutesWidth).toBeCloseTo(30, 5);
    expect(layout.hasProportionalScaleWarning).toBe(false);
    expect(layout.rulerTicks.length).toBeGreaterThan(0);
  });

  it('groups compact scenes into chapter duration spans', () => {
    const layout = buildStoryTimelineLayout([
      scene('first', { chapterDurationLabel: '2 hours', duration: 1, durationType: 'hours' }),
      scene('second', { chapterDurationLabel: '2 hours', duration: 1, durationType: 'hours' }),
    ]);

    expect(layout.chapters).toEqual([
      expect.objectContaining({ id: 'chapter', durationLabel: '2 hours' }),
    ]);
  });

  it('uses separate header lanes for chapters that overlap in time', () => {
    const layout = buildStoryTimelineLayout([
      scene('first', {
        chapterId: 'one',
        chapterName: 'One',
        duration: 5,
        durationType: 'hours',
      }),
      scene('second', {
        chapterId: 'two',
        chapterName: 'Two',
        gap: -2,
        gapType: 'hours',
        duration: 2,
        durationType: 'hours',
      }),
    ]);

    expect(layout.chapterLaneCount).toBe(2);
    expect(layout.chapters.map((chapter) => chapter.lane)).toEqual([0, 1]);
  });

  it('does not connect a scene that starts a separate chapter selection', () => {
    const layout = buildStoryTimelineLayout([
      scene('chapter-one', { duration: 1, durationType: 'hours' }),
      scene('chapter-three', {
        hideGapBefore: true,
        gap: 10,
        gapType: 'years',
        duration: 1,
        durationType: 'hours',
      }),
    ]);

    expect(layout.rows[1].gap).toBeUndefined();
  });

  it('moves backwards for negative gaps and durations without invalid dimensions', () => {
    const layout = buildStoryTimelineLayout([
      scene('first', { duration: 5, durationType: 'hours' }),
      scene('rewind', { gap: -2, gapType: 'hours', duration: -1, durationType: 'hours' }),
    ]);
    const rewind = layout.rows[1];

    expect(rewind.gapEnd).toBeLessThan(rewind.gapStart!);
    expect(rewind.barEnd).toBeLessThan(rewind.barStart);
    expect(Number.isFinite(layout.width)).toBe(true);
    expect(layout.width).toBeGreaterThan(0);
  });
});
