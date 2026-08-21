import { orderItemJourneysByNarrative } from '../../src/utils/itemJourneyOrder';

const chapters = [
  { id: 'c1', name: 'One', index: 0 },
  { id: 'c2', name: 'Two', index: 1 },
];
const scenes = [
  { id: 's1', name: 'First', chapterId: 'c1', index: 0, isStart: true, isFinish: false },
  { id: 's2', name: 'Second', chapterId: 'c1', index: 1, isStart: false, isFinish: false },
  { id: 's3', name: 'Third', chapterId: 'c2', index: 0, isStart: false, isFinish: true },
];

describe('orderItemJourneysByNarrative', () => {
  it('uses chapter and scene order for linear stories without mutating input', () => {
    const journeys = [
      { id: 'third', sceneId: 's3', createdAt: new Date('2026-01-03') },
      { id: 'unknown', sceneId: 'gone', createdAt: new Date('2026-01-01') },
      { id: 'first', sceneId: 's1', createdAt: new Date('2026-01-02') },
      { id: 'second', sceneId: 's2', createdAt: new Date('2026-01-01') },
    ];

    expect(
      orderItemJourneysByNarrative(journeys, 'linear', scenes, [], chapters).map(
        (journey) => journey.id,
      ),
    ).toEqual(['first', 'second', 'third', 'unknown']);
    expect(journeys[0].id).toBe('third');
  });

  it('uses graph layers for branching stories', () => {
    const journeys = [
      { id: 'finish', sceneId: 's3', createdAt: new Date() },
      { id: 'start', sceneId: 's1', createdAt: new Date() },
    ];
    const choices = [{ id: 'choice', sceneId: 's1', nextSceneId: 's3', text: 'Continue' }];

    expect(
      orderItemJourneysByNarrative(journeys, 'branching', scenes, choices, chapters).map(
        (journey) => journey.id,
      ),
    ).toEqual(['start', 'finish']);
  });
});
