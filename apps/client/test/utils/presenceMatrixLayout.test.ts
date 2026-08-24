import {
  buildPresenceMatrixLayout,
  MATRIX_SCENE_WIDTH,
} from '../../src/utils/presenceMatrixLayout';

const scene = (id: string) => ({
  id,
  name: id,
  chapterName: 'Chapter',
  chapterColor: '#123456',
});

describe('presence matrix layout', () => {
  it('keeps the spacious scene columns for short stories', () => {
    const layout = buildPresenceMatrixLayout([scene('one'), scene('two')], []);

    expect(layout.sceneWidth).toBe(MATRIX_SCENE_WIDTH);
  });

  it('uses progressively narrower columns for longer stories', () => {
    const medium = buildPresenceMatrixLayout(
      Array.from({ length: 10 }, (_, index) => scene(`${index}`)),
      [],
    );
    const long = buildPresenceMatrixLayout(
      Array.from({ length: 20 }, (_, index) => scene(`${index}`)),
      [],
    );

    expect(medium.sceneWidth).toBeLessThan(MATRIX_SCENE_WIDTH);
    expect(long.sceneWidth).toBeLessThan(medium.sceneWidth);
  });
});
