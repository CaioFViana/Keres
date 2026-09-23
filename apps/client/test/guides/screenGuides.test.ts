import { screenAnchorId } from '../../src/guides/anchorRegistry';
import { getScreenGuide } from '../../src/guides/registry';

describe.each([
  ['BoardCanvas', 'BoardCanvas', 'boards'],
  ['LocationMap', 'LocationMap', 'location-map'],
] as const)('%s tour', (guideId, screen, helpPageId) => {
  it('walks document actions, the add group, then the mode toggles', () => {
    const guide = getScreenGuide(guideId);

    expect(guide?.id).toBe(guideId);
    expect(guide?.drawerId).toBe('main-system');
    expect(guide?.helpPageId).toBe(helpPageId);
    expect(guide?.steps.map((step) => step.id)).toEqual(['document', 'add', 'modes']);
    expect(guide?.steps.map((step) => step.anchors)).toEqual([
      [screenAnchorId(screen, 'document')],
      [screenAnchorId(screen, 'add')],
      [screenAnchorId(screen, 'modes')],
    ]);
    const prefix = `tour_${guideId.toLowerCase()}_`;
    expect(guide?.steps.map((step) => step.titleKey)).toEqual([
      `${prefix}document_title`,
      `${prefix}add_title`,
      `${prefix}modes_title`,
    ]);
    expect(guide?.steps.map((step) => step.bodyKey)).toEqual([
      `${prefix}document_body`,
      `${prefix}add_body`,
      `${prefix}modes_body`,
    ]);
  });
});
