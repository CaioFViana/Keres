import { describe, expect, it } from 'vitest';
import { buildNarrativeProjection } from '../../utils/narrativeProjection';

const chapters = [
  { id: 'chapter-1', name: 'One', index: 1 },
  { id: 'chapter-2', name: 'Two', index: 2 },
];
const scenes = [
  { id: 'a', name: 'A', chapterId: 'chapter-1', index: 1, isStart: true, isFinish: false },
  { id: 'b', name: 'B', chapterId: 'chapter-1', index: 2, isStart: false, isFinish: false },
  { id: 'c', name: 'C', chapterId: 'chapter-2', index: 1, isStart: false, isFinish: true },
];

describe('buildNarrativeProjection', () => {
  it('derives display-only flow edges from the linear narrative order', () => {
    const projection = buildNarrativeProjection({
      storyType: 'linear',
      scenes: [scenes[2], scenes[1], scenes[0]],
      choices: [],
      chapters,
    });

    expect(projection.order).toBe('narrative-order');
    expect(projection.scenes.map((scene) => scene.id)).toEqual(['a', 'b', 'c']);
    expect(projection.implicitEdges).toEqual([
      { sceneId: 'a', nextSceneId: 'b' },
      { sceneId: 'b', nextSceneId: 'c' },
    ]);
  });

  it('uses graph layers as a catalogue order for branching without inventing edges', () => {
    const projection = buildNarrativeProjection({
      storyType: 'branching',
      scenes: [scenes[2], scenes[1], scenes[0]],
      choices: [
        { id: 'a-b', sceneId: 'a', nextSceneId: 'b', text: 'Go B' },
        { id: 'b-c', sceneId: 'b', nextSceneId: 'c', text: 'Go C' },
      ],
      chapters,
    });

    expect(projection.order).toBe('catalogue-order');
    expect(projection.scenes.map((scene) => scene.id)).toEqual(['a', 'b', 'c']);
    expect(projection.implicitEdges).toEqual([]);
    expect(projection.layerBySceneId.get('a')).toBeLessThan(projection.layerBySceneId.get('b')!);
  });
});
