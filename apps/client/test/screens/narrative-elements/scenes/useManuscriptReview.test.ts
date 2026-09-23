jest.mock('../../../../src/hooks/useSceneBodyComments', () => ({
  useSceneBodyComments: jest.fn(),
}));
jest.mock('../../../../src/hooks/useWebSelectionClip', () => ({
  trackSelectionContainer: jest.fn(),
  readClippedSelection: jest.fn(),
}));

import type { ManuscriptChapter, ManuscriptScene } from '@keres/shared';
import { linearManuscriptSections } from '@keres/shared';
import { resolveReviewScene } from '../../../../src/screens/narrative-elements/scenes/useManuscriptReview';

const chapters: ManuscriptChapter[] = [{ id: 'ch-1', name: 'Arrival', index: 1, type: 'chapter' }];
const scenes: ManuscriptScene[] = [
  { id: 's-1', chapterId: 'ch-1', name: 'Opening', index: 1, body: 'Alpha.', isDeleted: false },
  { id: 's-2', chapterId: null, name: 'Fragment', index: 2, body: 'Lost.', isDeleted: false },
];
// [container ch-1, scene s-1, loose-heading, scene s-2]
const sections = linearManuscriptSections(chapters, scenes);

describe('resolveReviewScene', () => {
  it('starts at the first scene without a position', () => {
    expect(resolveReviewScene(sections, null)?.scene.id).toBe('s-1');
  });

  it('keeps a scene position', () => {
    expect(resolveReviewScene(sections, 1)?.scene.id).toBe('s-1');
    expect(resolveReviewScene(sections, 3)?.scene.id).toBe('s-2');
  });

  it('falls forward off landmarks, then back', () => {
    expect(resolveReviewScene(sections, 0)?.scene.id).toBe('s-1');
    expect(resolveReviewScene(sections, 2)?.scene.id).toBe('s-2');
  });

  it('resolves null without scenes', () => {
    expect(resolveReviewScene([], null)).toBeNull();
  });
});
