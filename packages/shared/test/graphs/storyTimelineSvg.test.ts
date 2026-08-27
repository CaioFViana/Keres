import { describe, expect, it } from 'vitest';
import { buildStoryTimelineLayout } from '../../graphs/storyTimelineLayout';
import { renderStoryTimelineSvg } from '../../graphs/storyTimelineSvg';

const colors = {
  background: '#ffffff',
  surface: '#f4f4f4',
  text: '#111111',
  textSecondary: '#666666',
  border: '#cccccc',
};

const options = {
  title: 'A <story>',
  subtitle: 'Timeline & chronology',
  labels: { gap: 'Gap', duration: 'Duration', compressed: 'Compressed' },
  storyDuration: { title: 'Story duration', value: '2 hours' },
  colors,
};

const scene = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Scene ${id}`,
  chapterId: 'chapter',
  chapterName: 'Opening',
  chapterColor: '#336699',
  index: 1,
  ...extra,
});

describe('renderStoryTimelineSvg', () => {
  it('renders compact rows, chapter labels, gaps and durations as escaped SVG', () => {
    const layout = buildStoryTimelineLayout([
      scene('one', { duration: 1, durationType: 'hours', durationLabel: '1 hour' }),
      scene('two', {
        name: 'Escape & return',
        gap: 30,
        gapType: 'minutes',
        gapLabel: '30 minutes',
        duration: 1,
        durationType: 'hours',
        durationLabel: '1 hour',
      }),
    ]);

    const svg = renderStoryTimelineSvg(layout, options);

    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('<title>A &lt;story&gt;</title>');
    expect(svg).toContain('Timeline &amp; chronology');
    expect(svg).toContain('Escape &amp; return');
    expect(svg).toContain('stroke-dasharray="5 4"');
    expect(svg).toContain('30 minutes');
    expect(svg).toContain('1 hour');
    expect(svg).toContain('Story duration: 2 hours');
  });

  it('renders ruler ticks in proportional mode', () => {
    const layout = buildStoryTimelineLayout(
      [
        scene('one', { duration: 1, durationType: 'hours' }),
        scene('two', { gap: 1, gapType: 'hours', duration: 1, durationType: 'hours' }),
      ],
      { scaleMode: 'proportional' },
    );

    const svg = renderStoryTimelineSvg(layout, options);

    expect(layout.rulerTicks.length).toBeGreaterThan(0);
    for (const tick of layout.rulerTicks) {
      expect(svg).toContain(`x1="${tick.x}"`);
      expect(svg).toContain(`>${tick.label}</text>`);
    }
    expect(svg).not.toContain('Story duration: 2 hours');
  });

  it('omits optional timing labels when a scene has no timing metadata', () => {
    const layout = buildStoryTimelineLayout([scene('untimed')]);
    const svg = renderStoryTimelineSvg(layout, {
      ...options,
      storyDuration: { title: 'Story duration', value: '' },
    });

    expect(svg).toContain('Story duration</text>');
    expect(svg).not.toContain('Story duration:');
    expect(svg).not.toContain('fill="#fff"');
  });
});

describe('renderStoryTimelineSvg with anchored containers', () => {
  const anchoredOptions = {
    ...options,
    labels: { ...options.labels, unanchored: 'Not placed' },
  };
  const scenes = [
    scene('one', { index: 1, duration: 1, durationType: 'hours' }),
    scene('two', { index: 2, duration: 1, durationType: 'hours' }),
  ];

  it('draws a band and names it once per container', () => {
    const layout = buildStoryTimelineLayout(scenes, {
      anchored: [
        {
          id: 'war',
          name: 'The <War>',
          color: '#ff0000',
          isEvent: true,
          stretches: [
            {
              start: { sceneId: 'one', position: 'start' },
              end: { sceneId: 'one', position: 'end' },
            },
            {
              start: { sceneId: 'two', position: 'start' },
              end: { sceneId: 'two', position: 'end' },
            },
          ],
        },
      ],
    });
    const svg = renderStoryTimelineSvg(layout, anchoredOptions);

    expect(layout.eventSpans).toHaveLength(2);
    // Two bands, one name: the second stretch is the same war resuming.
    expect(svg.match(/The &lt;War&gt;/g)).toHaveLength(1);
    expect(svg).toContain('fill="#ff0000"');
  });

  it('marks an anchored chapter apart from an event', () => {
    const asChapter = renderStoryTimelineSvg(
      buildStoryTimelineLayout(scenes, {
        anchored: [
          {
            id: 'flashback',
            name: 'Flashback',
            color: '#00ff00',
            isEvent: false,
            stretches: [
              {
                start: { sceneId: 'one', position: 'start' },
                end: { sceneId: 'two', position: 'end' },
              },
            ],
          },
        ],
      }),
      anchoredOptions,
    );

    expect(asChapter).toContain('stroke-dasharray="4 3"');
  });

  it('names the containers it could not place', () => {
    const layout = buildStoryTimelineLayout(scenes, {
      anchored: [
        {
          id: 'elsewhere',
          name: 'Elsewhere',
          color: '#0000ff',
          isEvent: true,
          stretches: [
            {
              start: { sceneId: 'missing', position: 'start' },
              end: { sceneId: 'missing', position: 'end' },
            },
          ],
        },
      ],
    });
    const svg = renderStoryTimelineSvg(layout, anchoredOptions);

    expect(svg).toContain('Not placed: Elsewhere');
  });

  it('draws an instant as a marker and can name scenes on their bars', () => {
    const layout = buildStoryTimelineLayout(
      [scene('one', { index: 1, duration: 0, durationType: 'seconds' })],
      {
        anchored: [
          {
            id: 'flash',
            name: 'Flash',
            color: '#ff0000',
            isEvent: true,
            stretches: [{ start: { sceneId: 'one', position: 'start' } }],
          },
        ],
      },
    );
    const svg = renderStoryTimelineSvg(layout, { ...anchoredOptions, showSceneNames: true });

    expect(layout.rows[0].instant).toBe(true);
    expect(layout.eventSpans[0].instant).toBe(true);
    expect(svg).toContain('<polygon');
    expect(svg).toContain('1. Scene one');
  });

  it('pushes the scene rows below the bands', () => {
    const plain = buildStoryTimelineLayout(scenes);
    const banded = buildStoryTimelineLayout(scenes, {
      anchored: [
        {
          id: 'war',
          name: 'War',
          color: '#ff0000',
          isEvent: true,
          stretches: [
            {
              start: { sceneId: 'one', position: 'start' },
              end: { sceneId: 'two', position: 'end' },
            },
          ],
        },
      ],
    });

    expect(banded.height).toBeGreaterThan(plain.height);
    expect(renderStoryTimelineSvg(banded, anchoredOptions)).toContain(`height="${banded.height}"`);
  });
});
