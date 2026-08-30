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
    const layout = buildStoryTimelineLayout(threeScenes, {
      anchored: [container('war', [{ start: point('a', 'start'), end: point('c', 'end') }])],
    });

    expect(layout.eventSpans).toHaveLength(1);
    const [span] = layout.eventSpans;
    expect(span.start).toBeCloseTo(layout.rows[0].barStart, 5);
    expect(span.end).toBeCloseTo(layout.rows[2].barEnd, 5);
    expect(layout.unanchoredNames).toEqual([]);
  });

  it('places the middle of a scene halfway across its bar', () => {
    const layout = buildStoryTimelineLayout(threeScenes, {
      anchored: [container('duel', [{ start: point('b', 'middle'), end: point('b', 'end') }])],
    });

    const row = layout.rows[1];
    expect(layout.eventSpans[0].start).toBeCloseTo((row.barStart + row.barEnd) / 2, 5);
  });

  it('keeps every stretch of one container in the same lane', () => {
    const layout = buildStoryTimelineLayout(threeScenes, {
      anchored: [
        container('siege', [
          { start: point('a', 'start'), end: point('a', 'end') },
          { start: point('c', 'start'), end: point('c', 'end') },
        ]),
      ],
    });

    expect(layout.eventSpans.map((span) => span.lane)).toEqual([0, 0]);
    expect(layout.eventSpans.map((span) => span.stretchIndex)).toEqual([0, 1]);
    expect(layout.eventLaneCount).toBe(1);
  });

  it('drops a container onto a second lane only when it would overlap', () => {
    const layout = buildStoryTimelineLayout(threeScenes, {
      anchored: [
        container('first', [{ start: point('a', 'start'), end: point('c', 'end') }]),
        container('overlapping', [{ start: point('b', 'start'), end: point('c', 'end') }]),
        container('later', [{ start: point('c', 'end'), end: point('c', 'end') }]),
      ],
    });

    const laneOf = (id: string) => layout.eventSpans.find((span) => span.id === id)?.lane;
    expect(laneOf('first')).toBe(0);
    expect(laneOf('overlapping')).toBe(1);
    // Starts where the first one ended, so it fits back into lane 0 rather than opening a third.
    expect(laneOf('later')).toBe(0);
    expect(layout.eventLaneCount).toBe(2);
  });

  it('reads a stretch stated back to front as a band rather than as nothing', () => {
    const layout = buildStoryTimelineLayout(threeScenes, {
      anchored: [container('backwards', [{ start: point('c', 'end'), end: point('a', 'start') }])],
    });

    const [span] = layout.eventSpans;
    expect(span.start).toBeLessThan(span.end);
  });

  it('lists a container whose scenes are all off screen instead of dropping it', () => {
    const layout = buildStoryTimelineLayout(threeScenes, {
      anchored: [
        container('elsewhere', [
          { start: point('missing', 'start'), end: point('missing', 'end') },
        ]),
      ],
    });

    expect(layout.eventSpans).toEqual([]);
    expect(layout.unanchoredNames).toEqual(['elsewhere']);
  });

  describe('ghost anchors', () => {
    it('places a negative offset before the scene it was measured from', () => {
      const layout = buildStoryTimelineLayout(threeScenes, {
        anchored: [
          container('ancient', [
            {
              start: point('a', 'start', { offset: -300, offsetUnit: 'years' }),
              end: point('a', 'start'),
            },
          ]),
        ],
      });

      const [span] = layout.eventSpans;
      expect(span.start).toBeLessThan(span.end);
    });

    it('moves the whole drawing right so a ghost anchor is not drawn under the labels', () => {
      const plain = buildStoryTimelineLayout(threeScenes);
      const withGhost = buildStoryTimelineLayout(threeScenes, {
        anchored: [
          container('ancient', [
            {
              start: point('a', 'start', { offset: -300, offsetUnit: 'years' }),
              end: point('a', 'start'),
            },
          ]),
        ],
      });

      const labelEdge = TIMELINE_PADDING + TIMELINE_LABEL_WIDTH;
      expect(withGhost.eventSpans[0].start).toBeGreaterThanOrEqual(labelEdge);
      // The scenes moved with it, so the ghost did not merely get clipped into place.
      expect(withGhost.rows[0].barStart).toBeGreaterThan(plain.rows[0].barStart);
      expect(withGhost.width).toBeGreaterThan(plain.width);
    });

    it('ignores an offset with no unit', () => {
      const layout = buildStoryTimelineLayout(threeScenes, {
        anchored: [
          container('vague', [
            { start: point('a', 'start', { offset: -300 }), end: point('a', 'end') },
          ]),
        ],
      });

      expect(layout.eventSpans[0].start).toBeCloseTo(layout.rows[0].barStart, 5);
    });
  });

  it('adds one lane of height to the drawing for each band', () => {
    const plain = buildStoryTimelineLayout(threeScenes);
    const withBands = buildStoryTimelineLayout(threeScenes, {
      anchored: [
        container('one', [{ start: point('a', 'start'), end: point('a', 'end') }]),
        container('two', [{ start: point('a', 'start'), end: point('c', 'end') }]),
      ],
    });

    expect(withBands.eventLaneCount).toBe(2);
    expect(withBands.height).toBeGreaterThan(plain.height);
  });

  it('has no bands and no extra height when nothing is anchored', () => {
    const layout = buildStoryTimelineLayout(threeScenes);

    expect(layout.eventSpans).toEqual([]);
    expect(layout.eventLaneCount).toBe(0);
    expect(layout.unanchoredNames).toEqual([]);
  });

  describe('open stretches', () => {
    it("lasts as long as the container's own scenes, on the same scale as the spine", () => {
      const layout = buildStoryTimelineLayout(threeScenes, {
        anchored: [
          {
            ...container('war', [{ start: point('a', 'start') }]),
            scenes: [
              { id: 'battle-1', name: 'Battle 1', index: 1, duration: 1, durationType: 'hours' },
              { id: 'battle-2', name: 'Battle 2', index: 2, duration: 1, durationType: 'hours' },
            ],
          },
        ],
      });

      const [span] = layout.eventSpans;
      const hour = layout.rows[0].barEnd - layout.rows[0].barStart;
      expect(span.start).toBeCloseTo(layout.rows[0].barStart, 5);
      expect(span.end - span.start).toBeCloseTo(hour * 2, 5);
      expect(span.instant).toBeFalsy();
    });

    it('is an instant when the container has no scenes', () => {
      const layout = buildStoryTimelineLayout(threeScenes, {
        anchored: [container('flash', [{ start: point('b', 'middle') }])],
      });

      const [span] = layout.eventSpans;
      expect(span.start).toBe(span.end);
      expect(span.instant).toBe(true);
    });
  });

  describe('instants on the spine', () => {
    it('draws a zero-duration scene as a marker, not as a minimum-width bar', () => {
      const layout = buildStoryTimelineLayout([
        scene('beat', 0, { duration: 0, durationType: 'seconds' }),
        scene('after', 1, { duration: 1, durationType: 'hours' }),
      ]);

      expect(layout.rows[0].instant).toBe(true);
      expect(layout.rows[0].barEnd).toBe(layout.rows[0].barStart);
      expect(layout.rows[1].instant).toBeFalsy();
      expect(layout.rows[1].barEnd).toBeGreaterThan(layout.rows[1].barStart);
    });
  });

  describe('inline placement', () => {
    it('inserts an event as rows among the spine instead of overlay bands', () => {
      const overlay = buildStoryTimelineLayout(threeScenes, {
        anchored: [container('between', [{ start: point('b', 'end'), end: point('c', 'start') }])],
      });
      const inline = buildStoryTimelineLayout(threeScenes, {
        anchored: [container('between', [{ start: point('b', 'end'), end: point('c', 'start') }])],
        placement: 'inline',
      });

      expect(overlay.eventLaneCount).toBe(1);
      expect(inline.eventLaneCount).toBe(0);
      expect(inline.eventSpans).toEqual([]);
      expect(inline.rows.some((row) => row.kind === 'event' && row.id === 'between')).toBe(true);
      expect(inline.rows.filter((row) => row.kind === 'scene')).toHaveLength(3);
    });

    it('expands a measured event into its own scene rows, without duplicating an anchored chapter', () => {
      const inline = buildStoryTimelineLayout(threeScenes, {
        anchored: [
          {
            ...container('war', [{ start: point('a', 'start') }]),
            scenes: [
              { id: 'battle-1', name: 'Battle 1', index: 1, duration: 1, durationType: 'hours' },
            ],
          },
          {
            ...container('flashback', [{ start: point('a', 'start') }], false),
            scenes: threeScenes.map((entry) => ({
              id: entry.id,
              name: entry.name,
              index: entry.index,
              duration: 1,
              durationType: 'hours',
            })),
          },
        ],
        placement: 'inline',
      });

      expect(inline.rows.filter((row) => row.kind === 'event-scene').map((row) => row.id)).toEqual([
        'battle-1',
      ]);
      expect(inline.rows.filter((row) => row.kind === 'scene')).toHaveLength(3);
      expect(inline.eventSpans.some((span) => span.id === 'flashback')).toBe(true);
    });
  });
});
