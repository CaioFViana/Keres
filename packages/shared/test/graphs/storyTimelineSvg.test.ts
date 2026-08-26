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
      'proportional',
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
