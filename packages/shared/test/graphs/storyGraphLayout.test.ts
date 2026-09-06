import { describe, expect, it } from 'vitest';
import { buildStoryGraphLayout, wrapLabel } from '../../graphs/storyGraphLayout';

describe('wrapLabel', () => {
  it('normalizes whitespace and keeps short labels intact', () => {
    expect(wrapLabel('  The   White Rabbit ')).toEqual(['The White Rabbit']);
  });

  it('truncates labels that exceed the configured line budget', () => {
    expect(wrapLabel('one two three four five', 7, 2)).toEqual(['one two', 'three…']);
    expect(wrapLabel('supercalifragilistic', 6, 2)).toEqual(['super…']);
  });
});

describe('buildStoryGraphLayout', () => {
  const scenes = [
    {
      id: 'a',
      name: 'Start',
      chapterId: 'one',
      index: 1,
      isStart: true,
      isFinish: false,
    },
    {
      id: 'b',
      name: 'Branch',
      chapterId: 'one',
      index: 2,
      isStart: false,
      isFinish: false,
    },
    {
      id: 'c',
      name: 'Finish',
      chapterId: 'two',
      index: 1,
      isStart: false,
      isFinish: true,
    },
    {
      id: 'detached',
      name: 'Detached',
      chapterId: null,
      index: 9,
      isStart: false,
      isFinish: false,
    },
  ];
  const chapters = [
    { id: 'one', name: 'One', index: 1 },
    { id: 'two', name: 'Two', index: 2 },
  ];

  it('lays out all edge kinds, dangling choices, and detached scenes', () => {
    const layout = buildStoryGraphLayout(
      scenes,
      [
        { id: 'forward', sceneId: 'a', nextSceneId: 'b', text: 'Go' },
        { id: 'forward-2', sceneId: 'b', nextSceneId: 'c', text: 'Continue' },
        { id: 'backward', sceneId: 'c', nextSceneId: 'a', text: 'Return' },
        { id: 'self', sceneId: 'b', nextSceneId: 'b', text: 'Wait' },
        { id: 'missing', sceneId: 'a', nextSceneId: 'gone', text: 'Gone' },
      ],
      chapters,
    );
    expect(layout.edges.map((edge) => edge.kind).sort()).toEqual([
      'backward',
      'forward',
      'forward',
      'self',
    ]);
    expect(layout).toMatchObject({
      danglingChoiceCount: 1,
      hasBackwardEdges: true,
      detachedSceneCount: 1,
    });
    expect(layout.nodes.find((node) => node.id === 'detached')?.isDetached).toBe(true);
    expect(
      layout.edges.every((edge) => edge.path.startsWith('M ') && edge.arrowPoints.length > 0),
    ).toBe(true);
  });

  it('supports left-to-right placement and an empty graph', () => {
    const leftToRight = buildStoryGraphLayout(
      scenes.slice(0, 3),
      [{ id: 'edge', sceneId: 'a', nextSceneId: 'b', text: 'Go' }],
      chapters,
      'left-to-right',
    );
    expect(leftToRight.nodes[1].x).toBeGreaterThan(leftToRight.nodes[0].x);
    expect(buildStoryGraphLayout([], [], chapters)).toMatchObject({
      nodes: [],
      edges: [],
      detachedSceneCount: 0,
    });
  });

  it('orders dense branches with lateral cross-links without overlapping cards', () => {
    const denseScenes = [
      {
        id: 'start',
        name: 'Start',
        chapterId: 'one',
        index: 1,
        isStart: true,
        isFinish: false,
      },
      {
        id: 'left',
        name: 'Left',
        chapterId: 'one',
        index: 2,
        isStart: false,
        isFinish: false,
      },
      {
        id: 'right',
        name: 'Right',
        chapterId: 'one',
        index: 3,
        isStart: false,
        isFinish: false,
      },
      {
        id: 'end',
        name: 'End',
        chapterId: 'two',
        index: 1,
        isStart: false,
        isFinish: true,
      },
    ];
    const layout = buildStoryGraphLayout(
      denseScenes,
      [
        { id: 'a-left', sceneId: 'start', nextSceneId: 'left', text: 'L' },
        { id: 'a-right', sceneId: 'start', nextSceneId: 'right', text: 'R' },
        { id: 'left-end', sceneId: 'left', nextSceneId: 'end', text: 'Finish' },
        {
          id: 'right-end',
          sceneId: 'right',
          nextSceneId: 'end',
          text: 'Finish',
        },
        { id: 'lateral', sceneId: 'left', nextSceneId: 'right', text: 'Cross' },
      ],
      chapters,
    );
    expect(new Set(layout.nodes.map((node) => `${node.x}:${node.y}`)).size).toBe(
      layout.nodes.length,
    );
    expect(layout.width).toBeGreaterThan(0);
  });
});
