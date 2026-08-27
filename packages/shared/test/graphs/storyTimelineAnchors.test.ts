import { describe, expect, it } from 'vitest';
import type { TimelineAnchoredContainer } from '../../graphs/storyTimelineLayout';
import {
  buildStoryTimelineLayout,
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PADDING,
} from '../../graphs/storyTimelineLayout';

const scene = (id: string, index: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  chapterId: 'chapter',
  chapterName: 'Chapter',
  chapterColor: '#123456',
  index,
  duration: 1,
  durationType: 'hours',
  ...extra,
});

const container = (
  id: string,
  stretches: TimelineAnchoredContainer['stretches'],
  isEvent = true,
): TimelineAnchoredContainer => ({ id, name: id, color: '#ff0000', isEvent, stretches });

const point = (sceneId: string, position: 'start' | 'middle' | 'end', extra = {}) => ({
  sceneId,
  position,
  ...extra,
});

const threeScenes = [scene('a', 0), scene('b', 1), scene('c', 2)];

describe('anchored containers on the story timeline', () => {
  it('spans from the start of one scene to the end of another', () => {
    const layout = buildStoryTimelineLayout(threeScenes, 'compact', [
      container('war', [{ start: point('a', 'start'), end: point('c', 'end') }]),
    ]);

    expect(layout.eventSpans).toHaveLength(1);
    const [span] = layout.eventSpans;
    expect(span.start).toBeCloseTo(layout.rows[0].barStart, 5);
    expect(span.end).toBeCloseTo(layout.rows[2].barEnd, 5);
    expect(layout.unanchoredNames).toEqual([]);
  });

  it('places the middle of a scene halfway across its bar', () => {
    const layout = buildStoryTimelineLayout(threeScenes, 'compact', [
      container('duel', [{ start: point('b', 'middle'), end: point('b', 'end') }]),
    ]);

    const row = layout.rows[1];
    expect(layout.eventSpans[0].start).toBeCloseTo((row.barStart + row.barEnd) / 2, 5);
  });

  it('keeps every stretch of one container in the same lane', () => {
    const layout = buildStoryTimelineLayout(threeScenes, 'compact', [
      container('siege', [
        { start: point('a', 'start'), end: point('a', 'end') },
        { start: point('c', 'start'), end: point('c', 'end') },
      ]),
    ]);

    expect(layout.eventSpans.map((span) => span.lane)).toEqual([0, 0]);
    expect(layout.eventSpans.map((span) => span.stretchIndex)).toEqual([0, 1]);
    expect(layout.eventLaneCount).toBe(1);
  });

  it('drops a container onto a second lane only when it would overlap', () => {
    const layout = buildStoryTimelineLayout(threeScenes, 'compact', [
      container('first', [{ start: point('a', 'start'), end: point('c', 'end') }]),
      container('overlapping', [{ start: point('b', 'start'), end: point('c', 'end') }]),
      container('later', [{ start: point('c', 'end'), end: point('c', 'end') }]),
    ]);

    const laneOf = (id: string) => layout.eventSpans.find((span) => span.id === id)?.lane;
    expect(laneOf('first')).toBe(0);
    expect(laneOf('overlapping')).toBe(1);
    // Starts where the first one ended, so it fits back into lane 0 rather than opening a third.
    expect(laneOf('later')).toBe(0);
    expect(layout.eventLaneCount).toBe(2);
  });

  it('reads a stretch stated back to front as a band rather than as nothing', () => {
    const layout = buildStoryTimelineLayout(threeScenes, 'compact', [
      container('backwards', [{ start: point('c', 'end'), end: point('a', 'start') }]),
    ]);

    const [span] = layout.eventSpans;
    expect(span.start).toBeLessThan(span.end);
  });

  it('lists a container whose scenes are all off screen instead of dropping it', () => {
    const layout = buildStoryTimelineLayout(threeScenes, 'compact', [
      container('elsewhere', [{ start: point('missing', 'start'), end: point('missing', 'end') }]),
    ]);

    expect(layout.eventSpans).toEqual([]);
    expect(layout.unanchoredNames).toEqual(['elsewhere']);
  });

  describe('ghost anchors', () => {
    it('places a negative offset before the scene it was measured from', () => {
      const layout = buildStoryTimelineLayout(threeScenes, 'compact', [
        container('ancient', [
          {
            start: point('a', 'start', { offset: -300, offsetUnit: 'years' }),
            end: point('a', 'start'),
          },
        ]),
      ]);

      const [span] = layout.eventSpans;
      expect(span.start).toBeLessThan(span.end);
    });

    it('moves the whole drawing right so a ghost anchor is not drawn under the labels', () => {
      const plain = buildStoryTimelineLayout(threeScenes, 'compact');
      const withGhost = buildStoryTimelineLayout(threeScenes, 'compact', [
        container('ancient', [
          {
            start: point('a', 'start', { offset: -300, offsetUnit: 'years' }),
            end: point('a', 'start'),
          },
        ]),
      ]);

      const labelEdge = TIMELINE_PADDING + TIMELINE_LABEL_WIDTH;
      expect(withGhost.eventSpans[0].start).toBeGreaterThanOrEqual(labelEdge);
      // The scenes moved with it, so the ghost did not merely get clipped into place.
      expect(withGhost.rows[0].barStart).toBeGreaterThan(plain.rows[0].barStart);
      expect(withGhost.width).toBeGreaterThan(plain.width);
    });

    it('ignores an offset with no unit', () => {
      const layout = buildStoryTimelineLayout(threeScenes, 'compact', [
        container('vague', [
          { start: point('a', 'start', { offset: -300 }), end: point('a', 'end') },
        ]),
      ]);

      expect(layout.eventSpans[0].start).toBeCloseTo(layout.rows[0].barStart, 5);
    });
  });

  it('adds one lane of height to the drawing for each band', () => {
    const plain = buildStoryTimelineLayout(threeScenes, 'compact');
    const withBands = buildStoryTimelineLayout(threeScenes, 'compact', [
      container('one', [{ start: point('a', 'start'), end: point('a', 'end') }]),
      container('two', [{ start: point('a', 'start'), end: point('c', 'end') }]),
    ]);

    expect(withBands.eventLaneCount).toBe(2);
    expect(withBands.height).toBeGreaterThan(plain.height);
  });

  it('has no bands and no extra height when nothing is anchored', () => {
    const layout = buildStoryTimelineLayout(threeScenes);

    expect(layout.eventSpans).toEqual([]);
    expect(layout.eventLaneCount).toBe(0);
    expect(layout.unanchoredNames).toEqual([]);
  });
});
