import { describe, expect, it } from 'vitest';
import {
  buildTrajectoryStops,
  projectTrajectoryStops,
  type TrajectoryChapter,
  type TrajectoryScene,
} from '../../graphs/trajectories';

const chapters: TrajectoryChapter[] = [
  { id: 'ch-1', index: 1 },
  { id: 'ch-2', index: 2 },
];
const scenes: TrajectoryScene[] = [
  { id: 's-1', chapterId: 'ch-1', index: 1, locationId: 'loc-a' },
  { id: 's-2', chapterId: 'ch-1', index: 2, locationId: 'loc-a' },
  { id: 's-3', chapterId: 'ch-2', index: 1, locationId: 'loc-b' },
  { id: 's-4', chapterId: null, index: 1, locationId: 'loc-c' },
  { id: 's-5', chapterId: 'ch-2', index: 2, locationId: null },
];

describe('buildTrajectoryStops', () => {
  it('orders linear stops by chapter and scene, collapsing repeats', () => {
    const stops = buildTrajectoryStops({
      scenes,
      chapters,
      relevantSceneIds: new Set(['s-1', 's-2', 's-3', 's-4', 's-5']),
      storyType: 'linear',
    });
    // s-2 repeats loc-a after s-1; s-5 has nowhere to stand; the unchaptered
    // s-4 sorts after every chapter.
    expect(stops).toEqual([
      { sceneId: 's-1', locationId: 'loc-a' },
      { sceneId: 's-3', locationId: 'loc-b' },
      { sceneId: 's-4', locationId: 'loc-c' },
    ]);
  });

  it('keeps only relevant scenes', () => {
    const stops = buildTrajectoryStops({
      scenes,
      chapters,
      relevantSceneIds: new Set(['s-3']),
      storyType: 'linear',
    });
    expect(stops).toEqual([{ sceneId: 's-3', locationId: 'loc-b' }]);
  });

  it('follows route steps for branching stories, loops included', () => {
    const stops = buildTrajectoryStops({
      scenes,
      chapters,
      relevantSceneIds: new Set(['s-1', 's-3', 's-4']),
      storyType: 'branching',
      steps: [
        { sceneId: 's-4', position: 1 },
        { sceneId: 's-1', position: 2 },
        { sceneId: 's-3', position: 3 },
        { sceneId: 's-1', position: 4 },
      ],
    });
    expect(stops).toEqual([
      { sceneId: 's-4', locationId: 'loc-c' },
      { sceneId: 's-1', locationId: 'loc-a' },
      { sceneId: 's-3', locationId: 'loc-b' },
      { sceneId: 's-1', locationId: 'loc-a' },
    ]);
  });

  it('returns no order for branching stories without selected steps', () => {
    expect(
      buildTrajectoryStops({
        scenes,
        chapters,
        relevantSceneIds: new Set(['s-1']),
        storyType: 'branching',
      }),
    ).toEqual([]);
  });

  it('skips steps pointing at unknown scenes', () => {
    const stops = buildTrajectoryStops({
      scenes,
      chapters,
      relevantSceneIds: new Set(['s-1', 'gone']),
      storyType: 'branching',
      steps: [
        { sceneId: 'gone', position: 1 },
        { sceneId: 's-1', position: 2 },
      ],
    });
    expect(stops).toEqual([{ sceneId: 's-1', locationId: 'loc-a' }]);
  });
});

describe('projectTrajectoryStops', () => {
  it('maps stops to points and counts the off-map remainder', () => {
    const projected = projectTrajectoryStops(
      [
        { sceneId: 's-1', locationId: 'loc-a' },
        { sceneId: 's-3', locationId: 'loc-b' },
        { sceneId: 's-4', locationId: 'loc-c' },
      ],
      [
        { locationId: 'loc-a', x: 10, y: 20 },
        { locationId: 'loc-c', x: 30, y: 40 },
      ],
    );
    expect(projected).toEqual({
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
      offMap: 1,
    });
  });
});
